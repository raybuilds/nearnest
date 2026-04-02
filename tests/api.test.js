const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nearnest_test";
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "ci-secret";
}

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

test("expired JWT is rejected", async () => {
  const expiredToken = jwt.sign(
    { id: 1, role: "student" },
    TEST_SECRET,
    { expiresIn: "-1h" }
  );

  const response = await api("/profile", {
    token: expiredToken,
  });

  assert.equal(response.status, 401);
  assert.equal(response.data.error, "Invalid or expired token");
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
  let mediumUnitId = null;
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
          trustScore: 60,
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

    mediumUnitId = (
      await prisma.unit.create({
        data: {
          corridorId: corridorIdA,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 55,
          structuralApproved: true,
          operationalBaselineApproved: true,
          rent: 7600,
          distanceKm: 0.8,
          ac: true,
          capacity: 4,
          auditRequired: false,
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
    assert.ok(Array.isArray(studentSearch.data.data.recommendations));
    assert.ok(studentSearch.data.data.recommendations.length >= 2);
    for (let i = 1; i < studentSearch.data.data.recommendations.length; i += 1) {
      assert.ok(
        Number(studentSearch.data.data.recommendations[i - 1].rankingScore) >=
          Number(studentSearch.data.data.recommendations[i].rankingScore)
      );
    }

    const chainedSearch = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Only within 1 km" },
    });
    assert.equal(chainedSearch.status, 200);
    assert.equal(chainedSearch.data.intent, "student_search");
    assert.equal(chainedSearch.data.data.filters.maxDistance, 1);
    assert.equal(chainedSearch.data.data.filters.maxRent, 8000);
    assert.equal(chainedSearch.data.data.filters.ac, true);

    const studentDraft = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Lift not working on my floor" },
    });
    assert.equal(studentDraft.status, 200);
    assert.equal(studentDraft.data.intent, "student_complaint");
    assert.equal(studentDraft.data.requiresConfirmation, false);
    assert.deepEqual(studentDraft.data.data.missingFields, ["severity", "duration"]);
    assert.equal(studentDraft.data.data.preview.incidentType, "common_area");

    const studentDraftFollowUp = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Severity 3 for 2 days" },
    });
    assert.equal(studentDraftFollowUp.status, 200);
    assert.equal(studentDraftFollowUp.data.intent, "student_complaint");
    assert.equal(studentDraftFollowUp.data.requiresConfirmation, true);
    assert.equal(studentDraftFollowUp.data.action.payload.incidentType, "common_area");
    assert.equal(studentDraftFollowUp.data.action.payload.severity, 3);
    assert.equal(studentDraftFollowUp.data.action.payload.duration, "2 days");

    const resetContext = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "reset context" },
    });
    assert.equal(resetContext.status, 200);
    assert.equal(resetContext.data.intent, "context_reset");

    const electricalDraft = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Electrical sparks from switch board in my room" },
    });
    assert.equal(electricalDraft.status, 200);
    assert.equal(electricalDraft.data.intent, "student_complaint");
    assert.equal(electricalDraft.data.requiresConfirmation, false);
    assert.deepEqual(electricalDraft.data.data.missingFields, ["severity", "duration"]);
    assert.equal(electricalDraft.data.data.preview.incidentType, "electrical");
    assert.ok(Number(electricalDraft.data.data.preview.severity) >= 4);

    const electricalDraftFollowUp = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Severity 4 since today" },
    });
    assert.equal(electricalDraftFollowUp.status, 200);
    assert.equal(electricalDraftFollowUp.data.intent, "student_complaint");
    assert.equal(electricalDraftFollowUp.data.requiresConfirmation, true);
    assert.equal(electricalDraftFollowUp.data.action.payload.incidentType, "electrical");
    assert.ok(Number(electricalDraftFollowUp.data.action.payload.severity) >= 4);
    assert.equal(electricalDraftFollowUp.data.action.payload.duration, "since today");

    const studentSubmit = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: {
        message: "Lift not working on my floor",
        confirm: true,
        action: studentDraftFollowUp.data.action,
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

    const studentRisk = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Is this unit risky?" },
    });
    assert.equal(studentRisk.status, 200);
    assert.equal(studentRisk.data.intent, "predict_unit_risk");

    const riskFollowUp = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Why is it risky?" },
    });
    assert.equal(riskFollowUp.status, 200);
    assert.equal(riskFollowUp.data.intent, "explain_unit_trust");
    assert.equal(riskFollowUp.data.data.unitId, safeUnitId);
    assert.ok(Array.isArray(riskFollowUp.data.data.drivers));

    const safeFollowUp = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Is it safe?" },
    });
    assert.equal(safeFollowUp.status, 200);
    assert.equal(safeFollowUp.data.intent, "explain_unit_trust");
    assert.equal(safeFollowUp.data.data.unitId, safeUnitId);

    const unitDecision = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Should I take this?" },
    });
    assert.equal(unitDecision.status, 200);
    assert.equal(unitDecision.data.intent, "recommend_unit_decision");
    assert.equal(unitDecision.data.data.unitId, safeUnitId);
    assert.ok(typeof unitDecision.data.data.verdict === "string");
    assert.ok(typeof unitDecision.data.data.recommendation === "string");

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
    assert.ok(
      landlordRecurring.data.data.suggestions.some((item) =>
        String(item).toLowerCase().includes("faster resolution")
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
    assert.ok(corridorAEntry.complaintDensity > corridorBEntry.complaintDensity);
    assert.ok(Object.prototype.hasOwnProperty.call(corridorAEntry, "trustTrend"));
    assert.ok(Object.prototype.hasOwnProperty.call(corridorAEntry, "unitsNearSuspension"));
    assert.ok(Array.isArray(corridorAEntry.warnings));
    assert.ok(
      corridorAEntry.warnings.some((item) =>
        String(item).toLowerCase().includes("approaching enforcement threshold")
      )
    );

    const studentInsights = await api("/dawn/insights", {
      token: studentLogin.data.token,
    });
    assert.equal(studentInsights.status, 200);
    assert.ok(Array.isArray(studentInsights.data.insights));
    assert.equal(studentInsights.data.role, "student");
    assert.ok(
      studentInsights.data.insights.some(
        (item) => item.type === "risk_alert" && Array.isArray(item.affectedUnits) && item.affectedUnits.includes(safeUnitId)
      )
    );
    assert.ok(
      studentInsights.data.insights.some(
        (item) =>
          item.type === "trend_alert" &&
          Array.isArray(item.indicators) &&
          item.indicators.includes("Multiple SLA breaches detected")
      )
    );

    const landlordInsights = await api("/dawn/insights", {
      token: landlordLogin.data.token,
    });
    assert.equal(landlordInsights.status, 200);
    assert.ok(Array.isArray(landlordInsights.data.insights));
    assert.equal(landlordInsights.data.role, "landlord");
    assert.ok(
      landlordInsights.data.insights.some(
        (item) =>
          item.type === "risk_alert" &&
          Array.isArray(item.affectedUnits) &&
          item.affectedUnits.includes(safeUnitId)
      )
    );
    assert.ok(
      landlordInsights.data.insights.some(
        (item) =>
          item.type === "pattern_alert" &&
          String(item.message).toLowerCase().includes("water complaints are recurring")
      )
    );

    const adminInsights = await api("/dawn/insights", {
      token: adminLogin.data.token,
    });
    assert.equal(adminInsights.status, 200);
    assert.ok(Array.isArray(adminInsights.data.insights));
    assert.equal(adminInsights.data.role, "admin");
    assert.ok(
      adminInsights.data.insights.some(
        (item) => item.title === "Rising Complaint Density" && String(item.message).includes(corridorA.name)
      )
    );
    assert.ok(
      adminInsights.data.insights.some(
        (item) =>
          item.type === "risk_alert" &&
          typeof item.message === "string" &&
          Array.isArray(item.affectedUnits)
      )
    );

    const trustExplanation = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Explain trust score" },
    });
    assert.equal(trustExplanation.status, 200);
    assert.equal(trustExplanation.data.intent, "explain_unit_trust");
    assert.equal(trustExplanation.data.data.unitId, safeUnitId);
    assert.equal(trustExplanation.data.data.trustScore, 0);
    assert.ok(Array.isArray(trustExplanation.data.data.drivers));
    assert.ok(
      trustExplanation.data.data.drivers.some((item) =>
        String(item).toLowerCase().includes("water")
      )
    );
    assert.ok(
      trustExplanation.data.data.drivers.some((item) =>
        String(item).toLowerCase().includes("sla breach")
      )
    );
    assert.ok(
      trustExplanation.data.data.drivers.some((item) =>
        String(item).toLowerCase().includes("unresolved complaint")
      )
    );
  } finally {
    for (const unitId of [safeUnitId, riskyUnitId, mediumUnitId, otherCorridorUnitId]) {
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

test("dawn student unit health report", async () => {
  const tag = createTag("dawn-health");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordAccount = null;
  let unitId = null;

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

    unitId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 74,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
          rent: 8200,
          distanceKm: 1.1,
          ac: true,
        },
      })
    ).id;

    const occupantPublicId = generateOccupantId({
      cityCode: 12,
      corridorCode: corridorId,
      hostelCode: unitId,
      roomNumber: unitId,
      occupantIndex: 1,
    });

    await prisma.occupancy.create({
      data: {
        studentId: studentAccount.student.id,
        unitId,
        startDate: new Date(),
      },
    });

    await prisma.occupant.create({
      data: {
        publicId: occupantPublicId,
        cityCode: 12,
        corridorCode: corridorId,
        hostelCode: unitId,
        roomNumber: unitId,
        occupantIndex: 1,
        studentId: studentAccount.student.id,
        unitId,
        active: true,
      },
    });

    const now = Date.now();
    const seededComplaints = [
      { createdOffsetDays: 2, resolved: false, late: false, incidentType: "water" },
      { createdOffsetDays: 5, resolved: false, late: false, incidentType: "water" },
      { createdOffsetDays: 8, resolved: true, late: true, incidentType: "electrical" },
      { createdOffsetDays: 12, resolved: true, late: true, incidentType: "common_area" },
    ];

    for (const item of seededComplaints) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 6 : -6) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId,
          studentId: studentAccount.student.id,
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

    const studentLogin = await api("/auth/login", {
      method: "POST",
      body: { email: `${tag}-student@example.test`, password },
    });
    assert.equal(studentLogin.status, 200);

    const response = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "How is my housing doing?" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "student_unit_health");
    assert.equal(response.data.message, "Here is the health report for your housing:");
    assert.equal(response.data.healthReport.trustScore, 74);
    assert.equal(response.data.healthReport.complaintTrend, "declining");
    assert.equal(response.data.data.trustScore, 74);
    assert.equal(response.data.data.trend, "declining");
    assert.ok(Array.isArray(response.data.data.riskSignals));
    assert.ok(response.data.data.riskSignals.includes("Recurring complaints detected"));
    assert.ok(response.data.data.riskSignals.includes("Response delays detected"));
    assert.ok(typeof response.data.data.summary === "string");
    assert.equal(response.data.data.healthReport.trustScore, 74);
    assert.equal(response.data.data.healthReport.complaintTrend, "declining");
    assert.equal(response.data.data.healthReport.responsePerformance, "delayed");
    assert.ok(Array.isArray(response.data.data.healthReport.riskSignals));
    assert.ok(typeof response.data.data.healthReport.summary === "string");
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
    if (studentAccount) {
      await prisma.vDPEntry.deleteMany({ where: { studentId: studentAccount.student.id } });
      await prisma.student.deleteMany({ where: { id: studentAccount.student.id } });
      await prisma.user.deleteMany({ where: { id: studentAccount.user.id } });
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

test("predict unit risk surfaces deterministic risk signal details for student housing safety checks", async () => {
  const tag = createTag("unit-risk");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordAccount = null;
  let unitId = null;

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

    unitId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 58,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    await prisma.occupancy.create({
      data: {
        studentId: studentAccount.student.id,
        unitId,
        startDate: new Date(),
      },
    });

    const now = Date.now();
    const seededComplaints = [
      { createdOffsetDays: 2, resolved: false, late: false, severity: 4, incidentType: "electrical" },
      { createdOffsetDays: 4, resolved: false, late: false, severity: 4, incidentType: "safety" },
      { createdOffsetDays: 6, resolved: true, late: true, severity: 4, incidentType: "water" },
      { createdOffsetDays: 18, resolved: true, late: false, severity: 2, incidentType: "common_area" },
    ];

    for (const item of seededComplaints) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 6 : -6) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId,
          studentId: studentAccount.student.id,
          severity: item.severity,
          message: `${tag}-${item.incidentType}`,
          incidentType: item.incidentType,
          incidentFlag: true,
          createdAt,
          slaDeadline,
          resolved: item.resolved,
          resolvedAt,
        },
      });
    }

    const studentLogin = await api("/auth/login", {
      method: "POST",
      body: { email: `${tag}-student@example.test`, password },
    });
    assert.equal(studentLogin.status, 200);

    const response = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "Is my housing safe?" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "predict_unit_risk");
    assert.equal(response.data.message, "Here is the current risk forecast for your housing:");
    assert.equal(response.data.riskSignal.unitId, unitId);
    assert.equal(response.data.riskSignal.riskSignal, "EARLY_WARNING");
    assert.ok(response.data.assistant.includes("Risk Signal: EARLY_WARNING."));
    assert.ok(response.data.assistant.includes("Indicators:"));
    assert.ok(response.data.assistant.includes("Recommendation:"));
    assert.ok(Array.isArray(response.data.data.indicators));
    assert.ok(response.data.data.indicators.includes("Complaint frequency rising"));
    assert.ok(response.data.data.indicators.includes("Multiple SLA breaches detected"));
    assert.ok(response.data.data.indicators.includes("Trust score trending downward"));
    assert.equal(response.data.data.riskSignal.riskSignal, "EARLY_WARNING");
    assert.equal(response.data.data.metrics.complaintTrend, 2);
    assert.equal(response.data.data.metrics.severityTrend, 3);
    assert.equal(response.data.data.metrics.slaBreaches, 3);
    assert.ok(response.data.data.riskScore >= 1.7);
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
    if (studentAccount) {
      await prisma.vDPEntry.deleteMany({ where: { studentId: studentAccount.student.id } });
      await prisma.student.deleteMany({ where: { id: studentAccount.student.id } });
      await prisma.user.deleteMany({ where: { id: studentAccount.user.id } });
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

test("operations advisor returns deterministic landlord recommendations", async () => {
  const tag = createTag("ops-advisor");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordAccount = null;
  let unitAId = null;
  let unitBId = null;

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

    unitAId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 54,
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
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 66,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    const now = Date.now();
    const seededComplaints = [
      { unitId: unitAId, createdOffsetDays: 2, resolved: false, late: false, severity: 4, incidentType: "water" },
      { unitId: unitAId, createdOffsetDays: 4, resolved: false, late: false, severity: 4, incidentType: "water" },
      { unitId: unitAId, createdOffsetDays: 7, resolved: true, late: true, severity: 4, incidentType: "electrical" },
      { unitId: unitBId, createdOffsetDays: 5, resolved: true, late: true, severity: 3, incidentType: "water" },
      { unitId: unitBId, createdOffsetDays: 11, resolved: false, late: false, severity: 3, incidentType: "common_area" },
    ];

    for (const item of seededComplaints) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 6 : -6) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId: item.unitId,
          studentId: studentAccount.student.id,
          severity: item.severity,
          message: `${tag}-${item.incidentType}`,
          incidentType: item.incidentType,
          incidentFlag: true,
          createdAt,
          slaDeadline,
          resolved: item.resolved,
          resolvedAt,
        },
      });
    }

    const landlordLogin = await api("/auth/login", {
      method: "POST",
      body: { email: `${tag}-landlord@example.test`, password },
    });
    assert.equal(landlordLogin.status, 200);

    const response = await api("/dawn/query", {
      method: "POST",
      token: landlordLogin.data.token,
      body: { message: "Any operational problems?" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "operations_advisor");
    assert.equal(response.data.message, "Here is the current operational advisory summary:");
    assert.ok(response.data.assistant.includes("Operational Alert:"));
    assert.ok(Array.isArray(response.data.alerts));
    assert.ok(Array.isArray(response.data.data));
    assert.ok(
      response.data.data.some(
        (item) => item.title === "Units requiring attention" && Array.isArray(item.units) && item.units[0]?.unitId === unitAId
      )
    );
    assert.ok(
      response.data.data.some(
        (item) => item.title === "SLA performance issues" && Array.isArray(item.affectedUnits) && item.affectedUnits.includes(unitAId)
      )
    );
    assert.ok(
      response.data.data.some(
        (item) => item.title === "Recurring incident patterns" && String(item.message).includes("complaint types are repeating")
      )
    );
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
    if (landlordAccount) {
      await prisma.landlord.deleteMany({ where: { id: landlordAccount.landlord.id } });
      await prisma.user.deleteMany({ where: { id: landlordAccount.user.id } });
    }
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});

test("corridor behavioral insights", async () => {
  const tag = createTag("corridor-insights");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordAccount = null;
  let unitAId = null;
  let unitBId = null;
  let unitCId = null;

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

    unitAId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 52,
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
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 54,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    unitCId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 70,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    const now = Date.now();
    const seededComplaints = [
      { unitId: unitAId, incidentType: "water", createdOffsetDays: 2, resolved: true, late: true },
      { unitId: unitAId, incidentType: "water", createdOffsetDays: 4, resolved: true, late: true },
      { unitId: unitBId, incidentType: "water", createdOffsetDays: 6, resolved: false, late: false },
      { unitId: unitCId, incidentType: "common_area", createdOffsetDays: 8, resolved: false, late: false },
    ];

    for (const item of seededComplaints) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 5 : -5) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId: item.unitId,
          studentId: studentAccount.student.id,
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

    const studentLogin = await api("/auth/login", {
      method: "POST",
      body: { email: `${tag}-student@example.test`, password },
    });
    assert.equal(studentLogin.status, 200);

    const response = await api("/dawn/query", {
      method: "POST",
      token: studentLogin.data.token,
      body: { message: "corridor issues" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "corridor_behavioral_insight");
    assert.equal(response.data.message, "Here are the current corridor insights:");
    assert.ok(Array.isArray(response.data.insights));
    assert.ok(
      response.data.insights.includes("Recurring water complaints detected in this corridor.")
    );
    assert.ok(
      response.data.insights.includes("2 units near suspension threshold.")
    );
    assert.ok(
      response.data.insights.includes("Response delays increasing across corridor.")
    );
    assert.equal(response.data.data.unitsNearSuspension, 2);
    assert.equal(response.data.data.slaBreaches, 2);
    assert.equal(response.data.data.incidentFrequency.water, 3);
  } finally {
    for (const unitId of [unitAId, unitBId, unitCId]) {
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
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
    }
  }
});

test("landlord remediation advisor", async () => {
  const tag = createTag("remediation");
  const password = "pass123";

  let corridorId = null;
  let studentAccount = null;
  let landlordAccount = null;
  let unitAId = null;
  let unitBId = null;
  let unitCId = null;

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
    studentAccount = await createStudent({
      name: `${tag}-student`,
      email: `${tag}-student@example.test`,
      password,
      corridorId,
    });

    unitAId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 52,
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
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 58,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    unitCId = (
      await prisma.unit.create({
        data: {
          corridorId,
          landlordId: landlordAccount.landlord.id,
          status: "approved",
          trustScore: 75,
          structuralApproved: true,
          operationalBaselineApproved: true,
          capacity: 2,
        },
      })
    ).id;

    const now = Date.now();
    const seededComplaints = [
      { unitId: unitAId, createdOffsetDays: 2, resolved: false, late: false },
      { unitId: unitAId, createdOffsetDays: 4, resolved: false, late: false },
      { unitId: unitAId, createdOffsetDays: 7, resolved: true, late: true },
      { unitId: unitAId, createdOffsetDays: 10, resolved: true, late: true },
      { unitId: unitBId, createdOffsetDays: 3, resolved: false, late: false },
      { unitId: unitBId, createdOffsetDays: 6, resolved: true, late: true },
      { unitId: unitCId, createdOffsetDays: 5, resolved: false, late: false },
    ];

    for (const item of seededComplaints) {
      const createdAt = new Date(now - item.createdOffsetDays * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
      const resolvedAt = item.resolved
        ? new Date(slaDeadline.getTime() + (item.late ? 6 : -6) * 60 * 60 * 1000)
        : null;

      await prisma.complaint.create({
        data: {
          unitId: item.unitId,
          studentId: studentAccount.student.id,
          severity: 3,
          message: `${tag}-complaint-${item.unitId}`,
          incidentType: "water",
          incidentFlag: true,
          createdAt,
          slaDeadline,
          resolved: item.resolved,
          resolvedAt,
        },
      });
    }

    const landlordLogin = await api("/auth/login", {
      method: "POST",
      body: { email: `${tag}-landlord@example.test`, password },
    });
    assert.equal(landlordLogin.status, 200);

    const response = await api("/dawn/query", {
      method: "POST",
      token: landlordLogin.data.token,
      body: { message: "What should I fix?" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "landlord_remediation_advisor");
    assert.equal(response.data.message, "Here are the highest priority issues to address:");
    assert.ok(Array.isArray(response.data.priorities));
    assert.equal(response.data.priorities.length, 3);
    assert.equal(response.data.priorities[0].unitId, unitAId);
    assert.equal(response.data.data.priorities[0].unitId, unitAId);
    assert.ok(response.data.data.priorities[0].riskScore > response.data.data.priorities[1].riskScore);
    assert.ok(
      String(response.data.priorities[0].recommendation).includes("Inspect infrastructure")
    );
    assert.ok(
      String(response.data.data.priorities[0].recommendations.join(" ")).includes("Improve complaint response time")
    );
    assert.ok(
      String(response.data.data.priorities[0].recommendations.join(" ")).includes("Resolve pending complaints")
    );
  } finally {
    for (const unitId of [unitAId, unitBId, unitCId]) {
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
    if (corridorId) {
      await prisma.corridor.deleteMany({ where: { id: corridorId } });
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
