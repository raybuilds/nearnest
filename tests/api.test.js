const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const bcrypt = require("bcrypt");
const prisma = require("../prismaClient");
const { generateOccupantId } = require("../services/occupantIdService");

const TEST_PORT = 5107;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_SECRET = "test-secret";

let serverProcess = null;

function createTag(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function waitForServer() {
  const timeoutMs = 15000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch (_) {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Test server did not start in time");
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  return {
    status: response.status,
    data,
  };
}

async function createStudent({ name, email, password, corridorId, intake = "2026A" }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "student",
    },
  });
  const student = await prisma.student.create({
    data: {
      name,
      intake,
      corridorId,
      userId: user.id,
    },
  });
  return { user, student };
}

async function createLandlord({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "landlord",
    },
  });
  const landlord = await prisma.landlord.create({
    data: { userId: user.id },
  });
  return { user, landlord };
}

before(async () => {
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      JWT_SECRET: TEST_SECRET,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", () => {});
  serverProcess.stderr.on("data", () => {});

  await waitForServer();
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
  await prisma.$disconnect();
});

test("integration: student register -> login -> profile flow", async () => {
  const tag = createTag("integration");
  const email = `${tag}@example.test`;
  const password = "pass123";

  let corridorId = null;
  let createdUserId = null;
  let createdStudentId = null;

  try {
    const corridor = await prisma.corridor.create({
      data: { name: `${tag}-corridor`, cityCode: 12 },
    });
    corridorId = corridor.id;

    const registerResponse = await api("/auth/register", {
      method: "POST",
      body: {
        name: `${tag}-student`,
        email,
        password,
        role: "student",
        intake: "2026A",
        corridorId,
      },
    });

    assert.equal(registerResponse.status, 201);
    assert.ok(registerResponse.data.token);
    createdUserId = registerResponse.data.user.id;
    createdStudentId = registerResponse.data.studentId;

    const loginResponse = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.data.user.role, "student");
    assert.equal(loginResponse.data.studentId, createdStudentId);

    const profileResponse = await api("/profile", {
      token: loginResponse.data.token,
    });
    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.data.role, "student");
    assert.equal(profileResponse.data.identity.studentId, createdStudentId);
  } finally {
    if (createdStudentId) {
      await prisma.vDPEntry.deleteMany({ where: { studentId: createdStudentId } });
      await prisma.shortlist.deleteMany({ where: { studentId: createdStudentId } });
      await prisma.occupancy.deleteMany({ where: { studentId: createdStudentId } });
      await prisma.occupant.deleteMany({ where: { studentId: createdStudentId } });
      await prisma.complaint.deleteMany({ where: { studentId: createdStudentId } });
      await prisma.student.deleteMany({ where: { id: createdStudentId } });
    }
    if (createdUserId) {
      await prisma.landlord.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});

test("security: complaint with another student's occupantId is rejected", async () => {
  const tag = createTag("ownership");
  const password = "pass123";

  let corridorId = null;
  let unitId = null;
  let studentA = null;
  let studentB = null;
  let occupantPublicId = null;

  try {
    const corridor = await prisma.corridor.create({
      data: { name: `${tag}-corridor`, cityCode: 12 },
    });
    corridorId = corridor.id;

    const unit = await prisma.unit.create({
      data: {
        corridorId,
        status: "approved",
        trustScore: 80,
        structuralApproved: true,
        operationalBaselineApproved: true,
        capacity: 2,
      },
    });
    unitId = unit.id;

    studentA = await createStudent({
      name: `${tag}-student-a`,
      email: `${tag}-a@example.test`,
      password,
      corridorId,
    });
    studentB = await createStudent({
      name: `${tag}-student-b`,
      email: `${tag}-b@example.test`,
      password,
      corridorId,
    });

    occupantPublicId = generateOccupantId({
      cityCode: 12,
      corridorCode: corridorId,
      hostelCode: unitId,
      roomNumber: unitId,
      occupantIndex: 1,
    });

    await prisma.occupant.create({
      data: {
        publicId: occupantPublicId,
        cityCode: 12,
        corridorCode: corridorId,
        hostelCode: unitId,
        roomNumber: unitId,
        occupantIndex: 1,
        studentId: studentA.student.id,
        unitId,
        active: true,
      },
    });

    const loginB = await api("/auth/login", {
      method: "POST",
      body: {
        email: `${tag}-b@example.test`,
        password,
      },
    });
    assert.equal(loginB.status, 200);

    const complaint = await api("/complaint", {
      method: "POST",
      token: loginB.data.token,
      body: {
        occupantId: occupantPublicId,
        severity: 3,
        message: "Attempting unauthorized complaint",
      },
    });

    assert.equal(complaint.status, 400);
    assert.equal(complaint.data.error, "Invalid occupant ID");

    const complaintCount = await prisma.complaint.count({
      where: { studentId: studentB.student.id, unitId },
    });
    assert.equal(complaintCount, 0);
  } finally {
    if (unitId) {
      await prisma.complaint.deleteMany({ where: { unitId } });
      await prisma.occupancy.deleteMany({ where: { unitId } });
      await prisma.occupant.deleteMany({ where: { unitId } });
      await prisma.shortlist.deleteMany({ where: { unitId } });
      await prisma.auditLog.deleteMany({ where: { unitId } });
      await prisma.structuralChecklist.deleteMany({ where: { unitId } });
      await prisma.operationalChecklist.deleteMany({ where: { unitId } });
      await prisma.unitMedia.deleteMany({ where: { unitId } });
      await prisma.unit.deleteMany({ where: { id: unitId } });
    }
    for (const account of [studentA, studentB]) {
      if (!account) continue;
      await prisma.vDPEntry.deleteMany({ where: { studentId: account.student.id } });
      await prisma.student.deleteMany({ where: { id: account.student.id } });
      await prisma.user.deleteMany({ where: { id: account.user.id } });
    }
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});

test("transaction concurrency: parallel check-ins enforce capacity and slot invariants", async () => {
  const tag = createTag("concurrency");
  const password = "pass123";

  let corridorId = null;
  let unitId = null;
  let landlordAccount = null;
  let student1 = null;
  let student2 = null;

  try {
    const corridor = await prisma.corridor.create({
      data: { name: `${tag}-corridor`, cityCode: 12 },
    });
    corridorId = corridor.id;

    landlordAccount = await createLandlord({
      name: `${tag}-landlord`,
      email: `${tag}-landlord@example.test`,
      password,
    });

    unitId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 85,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 1,
        },
      })
    ).id;

    student1 = await createStudent({
      name: `${tag}-student-1`,
      email: `${tag}-student1@example.test`,
      password,
      corridorId,
    });
    student2 = await createStudent({
      name: `${tag}-student-2`,
      email: `${tag}-student2@example.test`,
      password,
      corridorId,
    });

    const login = await api("/auth/login", {
      method: "POST",
      body: {
        email: `${tag}-landlord@example.test`,
        password,
      },
    });
    assert.equal(login.status, 200);
    const landlordToken = login.data.token;

    const [r1, r2] = await Promise.all([
      api("/occupancy/check-in", {
        method: "POST",
        token: landlordToken,
        body: { unitId, studentId: student1.student.id },
      }),
      api("/occupancy/check-in", {
        method: "POST",
        token: landlordToken,
        body: { unitId, studentId: student2.student.id },
      }),
    ]);

    const statuses = [r1.status, r2.status];
    const successCount = statuses.filter((code) => code === 201).length;
    const rejectedCount = statuses.filter((code) => code === 400 || code === 409).length;

    assert.equal(successCount, 1);
    assert.equal(rejectedCount, 1);

    const activeOccupancies = await prisma.occupancy.count({
      where: { unitId, endDate: null },
    });
    const activeOccupants = await prisma.occupant.count({
      where: { unitId, active: true },
    });

    assert.equal(activeOccupancies, 1);
    assert.equal(activeOccupants, 1);
  } finally {
    if (unitId) {
      await prisma.complaint.deleteMany({ where: { unitId } });
      await prisma.occupancy.deleteMany({ where: { unitId } });
      await prisma.occupant.deleteMany({ where: { unitId } });
      await prisma.shortlist.deleteMany({ where: { unitId } });
      await prisma.auditLog.deleteMany({ where: { unitId } });
      await prisma.structuralChecklist.deleteMany({ where: { unitId } });
      await prisma.operationalChecklist.deleteMany({ where: { unitId } });
      await prisma.unitMedia.deleteMany({ where: { unitId } });
      await prisma.unit.deleteMany({ where: { id: unitId } });
    }
    for (const account of [student1, student2]) {
      if (!account) continue;
      await prisma.vDPEntry.deleteMany({ where: { studentId: account.student.id } });
      await prisma.student.deleteMany({ where: { id: account.student.id } });
      await prisma.user.deleteMany({ where: { id: account.user.id } });
    }
    if (landlordAccount) {
      await prisma.landlord.deleteMany({ where: { id: landlordAccount.landlord.id } });
      await prisma.user.deleteMany({ where: { id: landlordAccount.user.id } });
    }
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});
