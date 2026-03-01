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

async function createAdmin({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "admin",
    },
  });
  return { user };
}

before(async () => {
  serverProcess = spawn(process.execPath, ["index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      JWT_SECRET: TEST_SECRET,
      API_BASE_URL: BASE_URL,
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

test("dawn phase-1 intents: student, landlord, and admin flows are reachable and deterministic", async () => {
  const tag = createTag("dawn");
  const password = "pass123";

  let corridorIdA = null;
  let corridorIdB = null;
  let studentAccount = null;
  let landlordAccount = null;
  let adminAccount = null;
  let safeUnitId = null;
  let riskyUnitId = null;
  let otherCorridorUnitId = null;

  try {
    const [corridorA, corridorB] = await Promise.all([
      prisma.corridor.create({ data: { name: `${tag}-corridor-a`, cityCode: 12 } }),
      prisma.corridor.create({ data: { name: `${tag}-corridor-b`, cityCode: 12 } }),
    ]);
    corridorIdA = corridorA.id;
    corridorIdB = corridorB.id;

    landlordAccount = await createLandlord({
      name: `${tag}-landlord`,
      email: `${tag}-landlord@example.test`,
      password,
    });
    studentAccount = await createStudent({
      name: `${tag}-student`,
      email: `${tag}-student@example.test`,
      password,
      corridorId: corridorIdA,
    });
    adminAccount = await createAdmin({
      name: `${tag}-admin`,
      email: `${tag}-admin@example.test`,
      password,
    });

    await prisma.vDPEntry.create({
      data: {
        studentId: studentAccount.student.id,
        corridorId: corridorIdA,
        intake: "2026A",
        verified: true,
        status: "verified",
      },
    });

    safeUnitId = (
      await prisma.unit.create({
        data: {
          corridorId: corridorIdA,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 82,
          structuralApproved: true,
          operationalBaselineApproved: true,
          rent: 7800,
          distanceKm: 1.5,
          ac: true,
          capacity: 3,
          auditRequired: false,
        },
      })
    ).id;

    riskyUnitId = (
      await prisma.unit.create({
        data: {
          corridorId: corridorIdA,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 45,
          structuralApproved: true,
          operationalBaselineApproved: true,
          rent: 7200,
          distanceKm: 1.2,
          ac: true,
          capacity: 2,
          auditRequired: true,
        },
      })
    ).id;

    otherCorridorUnitId = (
      await prisma.unit.create({
        data: {
          corridorId: corridorIdB,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 70,
          structuralApproved: true,
          operationalBaselineApproved: true,
          rent: 7000,
          distanceKm: 1.0,
          ac: true,
          capacity: 2,
        },
      })
    ).id;

    const occupantPublicId = generateOccupantId({
      cityCode: 12,
      corridorCode: corridorIdA,
      hostelCode: safeUnitId,
      roomNumber: safeUnitId,
      occupantIndex: 1,
    });

    await prisma.occupancy.create({
      data: {
        studentId: studentAccount.student.id,
        unitId: safeUnitId,
        startDate: new Date(),
      },
    });

    await prisma.occupant.create({
      data: {
        publicId: occupantPublicId,
        cityCode: 12,
        corridorCode: corridorIdA,
        hostelCode: safeUnitId,
        roomNumber: safeUnitId,
        occupantIndex: 1,
        studentId: studentAccount.student.id,
        unitId: safeUnitId,
        active: true,
      },
    });

    const now = Date.now();
    const complaintSeed = [
      { unitId: safeUnitId, incidentType: "water", createdOffsetDays: 2, resolved: false },
      { unitId: safeUnitId, incidentType: "water", createdOffsetDays: 4, resolved: false },
      { unitId: safeUnitId, incidentType: "water", createdOffsetDays: 7, resolved: true, late: true },
      { unitId: safeUnitId, incidentType: "water", createdOffsetDays: 10, resolved: true, late: true },
      { unitId: safeUnitId, incidentType: "common_area", createdOffsetDays: 12, resolved: false },
      { unitId: riskyUnitId, incidentType: "safety", createdOffsetDays: 3, resolved: false },
      { unitId: otherCorridorUnitId, incidentType: "safety", createdOffsetDays: 5, resolved: false },
    ];

    for (const item of complaintSeed) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 6 : -6) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId: item.unitId,
          studentId: studentAccount.student.id,
          occupantRecordId: null,
          severity: 3,
          message: `${tag}-${item.incidentType}`,
          incidentType: item.incidentType,
          incidentFlag: item.incidentType !== "other",
          createdAt,
          slaDeadline,
          resolved: item.resolved,
          resolvedAt,
        },
      });
    }

    const [studentLogin, landlordLogin, adminLogin] = await Promise.all([
      api("/auth/login", {
        method: "POST",
        body: { email: `${tag}-student@example.test`, password },
      }),
      api("/auth/login", {
        method: "POST",
        body: { email: `${tag}-landlord@example.test`, password },
      }),
      api("/auth/login", {
        method: "POST",
        body: { email: `${tag}-admin@example.test`, password },
      }),
    ]);

    assert.equal(studentLogin.status, 200);
    assert.equal(landlordLogin.status, 200);
    assert.equal(adminLogin.status, 200);

    const studentSearch = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Show AC room under 8k near 2 km" },
    });
    assert.equal(studentSearch.status, 200);
    assert.equal(studentSearch.data.intent, "student_search");
    assert.ok(Array.isArray(studentSearch.data.data.data));
    assert.equal(studentSearch.data.data.data[0].id, safeUnitId);

    const studentDraft = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Lift not working on my floor" },
    });
    assert.equal(studentDraft.status, 200);
    assert.equal(studentDraft.data.intent, "student_complaint");
    assert.equal(studentDraft.data.requiresConfirmation, true);
    assert.equal(studentDraft.data.action.payload.incidentType, "common_area");

    const studentSubmit = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: {
        message: "Lift not working on my floor",
        confirm: true,
        action: studentDraft.data.action,
      },
    });
    assert.equal(studentSubmit.status, 200);
    assert.equal(studentSubmit.data.intent, "student_complaint");
    assert.ok(studentSubmit.data.data.complaintId);

    const studentSummary = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "How is my unit doing?" },
    });
    assert.equal(studentSummary.status, 200);
    assert.equal(studentSummary.data.intent, "student_complaint_summary");
    assert.ok(typeof studentSummary.data.data.complaints30d === "number");
    assert.ok(Object.prototype.hasOwnProperty.call(studentSummary.data.data, "trustScore"));
    assert.ok(Object.prototype.hasOwnProperty.call(studentSummary.data.data, "trustBand"));

    const landlordRecurring = await api("/dawn/query", {
      method: "POST",
      token: landlordLogin.data.token,
      body: { message: "Top recurring issues?" },
    });
    assert.equal(landlordRecurring.status, 200);
    assert.equal(landlordRecurring.data.intent, "landlord_recurring");
    assert.ok(Array.isArray(landlordRecurring.data.data.topIssues));
    assert.equal(landlordRecurring.data.data.topIssues[0].incidentType, "water");
    assert.ok(
      landlordRecurring.data.data.suggestions.some((item) =>
        String(item).toLowerCase().includes("plumbing")
      )
    );

    const landlordRisk = await api("/dawn/query", {
      method: "POST",
      token: landlordLogin.data.token,
      body: { message: "Which units are at risk?" },
    });
    assert.equal(landlordRisk.status, 200);
    assert.equal(landlordRisk.data.intent, "landlord_risk");
    assert.ok(Array.isArray(landlordRisk.data.data));
    assert.ok(landlordRisk.data.data.some((item) => item.unitId === riskyUnitId));

    const adminDensity = await api("/dawn/query", {
      method: "POST",
      token: adminLogin.data.token,
      body: { message: "Which corridor has highest complaint density?" },
    });
    assert.equal(adminDensity.status, 200);
    assert.equal(adminDensity.data.intent, "admin_density");
    assert.ok(Array.isArray(adminDensity.data.data.corridors));
    const corridorAEntry = adminDensity.data.data.corridors.find((item) => item.corridorId === corridorIdA);
    const corridorBEntry = adminDensity.data.data.corridors.find((item) => item.corridorId === corridorIdB);
    assert.ok(corridorAEntry);
    assert.ok(corridorBEntry);
    assert.ok(corridorAEntry.complaintCount > corridorBEntry.complaintCount);
  } finally {
    for (const unitId of [safeUnitId, riskyUnitId, otherCorridorUnitId]) {
      if (!unitId) continue;
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

    if (studentAccount) {
      await prisma.vDPEntry.deleteMany({ where: { studentId: studentAccount.student.id } });
      await prisma.student.deleteMany({ where: { id: studentAccount.student.id } });
      await prisma.user.deleteMany({ where: { id: studentAccount.user.id } });
    }
    if (landlordAccount) {
      await prisma.landlord.deleteMany({ where: { id: landlordAccount.landlord.id } });
      await prisma.user.deleteMany({ where: { id: landlordAccount.user.id } });
    }
    if (adminAccount) {
      await prisma.user.deleteMany({ where: { id: adminAccount.user.id } });
    }
    if (corridorIdA) {
      await prisma.corridor.deleteMany({ where: { id: corridorIdA } });
    }
    if (corridorIdB) {
      await prisma.corridor.deleteMany({ where: { id: corridorIdB } });
    }
  }
});

test("dawn negative: complaint without active occupancy is rejected and cross-landlord targeting is forbidden", async () => {
  const tag = createTag("dawn-negative");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordA = null;
  let landlordB = null;
  let unitAId = null;
  let unitBId = null;

  try {
    const corridor = await prisma.corridor.create({
      data: { name: `${tag}-corridor`, cityCode: 12 },
    });
    corridorId = corridor.id;

    studentAccount = await createStudent({
      name: `${tag}-student`,
      email: `${tag}-student@example.test`,
      password,
      corridorId,
    });

    await prisma.vDPEntry.create({
      data: {
        studentId: studentAccount.student.id,
        corridorId,
        intake: "2026A",
        verified: true,
        status: "verified",
      },
    });

    landlordA = await createLandlord({
      name: `${tag}-landlord-a`,
      email: `${tag}-landlord-a@example.test`,
      password,
    });
    landlordB = await createLandlord({
      name: `${tag}-landlord-b`,
      email: `${tag}-landlord-b@example.test`,
      password,
    });

    unitAId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordA.landlord.id,
          status: "approved",
          trustScore: 85,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    unitBId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordB.landlord.id,
          status: "approved",
          trustScore: 70,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    const [studentLogin, landlordALogin] = await Promise.all([
      api("/auth/login", {
        method: "POST",
        body: { email: `${tag}-student@example.test`, password },
      }),
      api("/auth/login", {
        method: "POST",
        body: { email: `${tag}-landlord-a@example.test`, password },
      }),
    ]);

    assert.equal(studentLogin.status, 200);
    assert.equal(landlordALogin.status, 200);

    const noOccupancyComplaint = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Water leakage in my bathroom" },
    });
    assert.equal(noOccupancyComplaint.status, 200);
    assert.equal(noOccupancyComplaint.data.intent, "student_complaint");
    assert.equal(noOccupancyComplaint.data.requiresConfirmation, undefined);
    assert.ok(
      String(noOccupancyComplaint.data.assistant || "")
        .toLowerCase()
        .includes("could not find an active occupancy")
    );

    const crossLandlordAccess = await api("/dawn/query", {
      method: "POST",
      token: landlordALogin.data.token,
      body: { message: `Which units are at risk for landlord ${landlordB.landlord.id}?` },
    });
    assert.equal(crossLandlordAccess.status, 403);
    assert.equal(crossLandlordAccess.data.error, "Dawn can only access your own landlord data");
  } finally {
    for (const unitId of [unitAId, unitBId]) {
      if (!unitId) continue;
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

    if (studentAccount) {
      await prisma.vDPEntry.deleteMany({ where: { studentId: studentAccount.student.id } });
      await prisma.student.deleteMany({ where: { id: studentAccount.student.id } });
      await prisma.user.deleteMany({ where: { id: studentAccount.user.id } });
    }
    for (const landlord of [landlordA, landlordB]) {
      if (!landlord) continue;
      await prisma.landlord.deleteMany({ where: { id: landlord.landlord.id } });
      await prisma.user.deleteMany({ where: { id: landlord.user.id } });
    }
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});
