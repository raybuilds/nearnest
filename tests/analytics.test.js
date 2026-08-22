const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nearnest_test";
}

const prisma = require("../prismaClient");
const TEST_PORT = 5110;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_SECRET = "analytics-test-secret";

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
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Test server did not start in time");
}

async function api(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody = undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
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

async function createUser(name, email, role, extra = {}) {
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      role,
    },
  });

  let roleRecord = null;
  if (role === "student") {
    roleRecord = await prisma.student.create({
      data: {
        name,
        intake: "2026",
        userId: user.id,
        corridorId: extra.corridorId,
      },
    });
  } else if (role === "landlord") {
    roleRecord = await prisma.landlord.create({
      data: {
        userId: user.id,
      },
    });
  } else if (role === "parent") {
    roleRecord = await prisma.parent.create({
      data: {
        userId: user.id,
        phoneNumber: extra.phoneNumber || "1234567890",
      },
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role }, TEST_SECRET, { expiresIn: "1h" });
  return { user, roleRecord, token };
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

  await waitForServer();
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
  await prisma.$disconnect();
});

test("Phase 7 Integration - Dashboard Analytics & DAWN Extension", async () => {
  const tag = createTag("p7");
  const corridor = await prisma.corridor.create({ data: { name: `Corridor-${tag}` } });

  // 1. Create student, parent, landlord, and admin users
  const { roleRecord: studentA, token: studentAToken } = await createUser(`Student A-${tag}`, `student-a-${tag}@test.com`, "student", { corridorId: corridor.id });
  const { roleRecord: studentB, token: studentBToken } = await createUser(`Student B-${tag}`, `student-b-${tag}@test.com`, "student", { corridorId: corridor.id });
  const { roleRecord: landlordA, token: landlordAToken } = await createUser(`Landlord A-${tag}`, `landlord-a-${tag}@test.com`, "landlord");
  const { roleRecord: landlordB, token: landlordBToken } = await createUser(`Landlord B-${tag}`, `landlord-b-${tag}@test.com`, "landlord");
  const { roleRecord: parentA, token: parentAToken } = await createUser(`Parent A-${tag}`, `parent-a-${tag}@test.com`, "parent");
  const { token: adminToken } = await createUser(`Admin-${tag}`, `admin-${tag}@test.com`, "admin");

  // 2. Setup Unit (Zero capacity handling check - we first create a unit with capacity = 0)
  const zeroCapacityUnit = await prisma.unit.create({
    data: {
      corridorId: corridor.id,
      landlordId: landlordA.id,
      rent: 5000,
      capacity: 0,
    },
  });

  const unitA = await prisma.unit.create({
    data: {
      corridorId: corridor.id,
      landlordId: landlordA.id,
      rent: 10000,
      capacity: 2,
    },
  });

  const occupancy1 = await prisma.occupancy.create({
    data: {
      unitId: unitA.id,
      studentId: studentA.id,
      startDate: new Date(),
    },
  });

  // Verify Parent link is active & verified
  await prisma.parentStudent.create({
    data: {
      parentId: parentA.id,
      studentId: studentA.id,
      verified: true,
      active: true,
    },
  });

  // Create GuestStay with duration to check calculations
  const pastDate = new Date(Date.now() - 4 * 24 * 3600 * 1000); // 4 days ago
  const guestStay = await prisma.guestStay.create({
    data: {
      guestName: "Guest X",
      occupancyId: occupancy1.id,
      startDate: pastDate,
      endDate: new Date(),
      active: false,
    },
  });

  // 3. Test endpoint Read-Only constraints (PUT/POST/PATCH to analytics fail)
  const postRes = await api("/api/student/analytics", { method: "POST", token: studentAToken, body: {} });
  assert.ok(postRes.status === 404 || postRes.status === 405); // Routes should not accept POST

  // 4. Test Zero Capacity Handled in metrics
  const zeroCapRes = await api(`/api/landlord/unit/${zeroCapacityUnit.id}/analytics`, { token: landlordAToken });
  assert.equal(zeroCapRes.status, 200);
  const zeroUtil = zeroCapRes.data.signals.find(s => s.type === "OCCUPANCY_UTILIZATION");
  assert.equal(zeroUtil.value, 0);

  // 5. Test Occupancy Utilization & Capacity pressure (>= 95% triggers alert)
  // Fill unitA capacity: add studentB to unitA
  const occupancy2 = await prisma.occupancy.create({
    data: {
      unitId: unitA.id,
      studentId: studentB.id,
      startDate: new Date(),
    },
  });

  const fullUnitRes = await api(`/api/landlord/unit/${unitA.id}/analytics`, { token: landlordAToken });
  assert.equal(fullUnitRes.status, 200);
  const utilSignal = fullUnitRes.data.signals.find(s => s.type === "OCCUPANCY_UTILIZATION");
  assert.equal(utilSignal.value, 1.0); // 2 active students / 2 capacity = 1.0

  const capacityRisk = fullUnitRes.data.risks.find(r => r.type === "CAPACITY_PRESSURE");
  assert.ok(capacityRisk);
  assert.equal(capacityRisk.severity, "MEDIUM");

  // Traceability validation: recommendations must point back to a signal
  const capacityRec = fullUnitRes.data.recommendations.find(r => r.type === "REVIEW_ALTERNATIVE_CAPACITY");
  assert.ok(capacityRec);
  assert.equal(capacityRec.triggerSignal, "OCCUPANCY_UTILIZATION");

  // 6. Payment delays & Rent volatility
  // Add payment audit logs to simulate delay
  const payment = await prisma.payment.create({
    data: {
      occupancyId: occupancy1.id,
      amount: 10000,
      month: "2026-08",
      status: "VERIFIED",
    },
  });

  await prisma.paymentAudit.createMany({
    data: [
      { paymentId: payment.id, actorId: studentA.userId, action: "SUBMIT", changes: { status: { old: "PENDING", new: "PAID" } }, createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
      { paymentId: payment.id, actorId: landlordA.userId, action: "VERIFY", changes: { status: { old: "PAID", new: "VERIFIED" } }, createdAt: new Date() },
    ],
  });

  // Rent Volatility check: add second month with 20% change
  const payment2 = await prisma.payment.create({
    data: {
      occupancyId: occupancy1.id,
      amount: 12000, // 20% increase
      month: "2026-09",
      status: "PENDING",
    },
  });

  const paymentRes = await api(`/api/landlord/unit/${unitA.id}/analytics`, { token: landlordAToken });
  assert.equal(paymentRes.status, 200);
  const delaySignal = paymentRes.data.signals.find(s => s.type === "PAYMENT_VERIFICATION_DELAY");
  assert.ok(delaySignal.value >= 2.9 && delaySignal.value <= 3.1); // ~3 days delay

  const volatilitySignal = paymentRes.data.signals.find(s => s.type === "RENT_VOLATILITY_DETECTED");
  assert.ok(volatilitySignal);
  assert.equal(volatilitySignal.value, 20);

  // 7. Guest stays duration calculation
  const guestSignal = paymentRes.data.signals.find(s => s.type === "AVERAGE_GUEST_DURATION");
  assert.ok(guestSignal.value >= 95 && guestSignal.value <= 97); // ~96 hours stay

  const guestRisk = paymentRes.data.risks.find(r => r.type === "EXTENDED_GUEST_STAY_PATTERN");
  assert.ok(guestRisk);

  // 8. Agreement Expirations
  // Create an active agreement expiring in 10 days
  const agreement = await prisma.agreement.create({
    data: {
      occupancyId: occupancy1.id,
      version: 1,
      status: "ACTIVE",
      rentAmount: 10000,
      securityDeposit: 20000,
      startDate: new Date(Date.now() - 100 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000), // Expiring soon
    },
  });

  const aggRes = await api(`/api/landlord/unit/${unitA.id}/analytics`, { token: landlordAToken });
  assert.equal(aggRes.status, 200);
  const aggRisk = aggRes.data.risks.find(r => r.type === "AGREEMENT_EXPIRATION_APPROACHING");
  assert.ok(aggRisk);

  // 9. Compliance Expiration & Completeness check
  // No compliance records submitted yet
  const compRes = await api(`/api/landlord/unit/${unitA.id}/analytics`, { token: landlordAToken });
  assert.equal(compRes.status, 200);
  const completenessRatio = compRes.data.signals.find(s => s.type === "COMPLIANCE_COMPLETENESS_RATIO");
  assert.equal(completenessRatio.value, 0);

  const compRisk = compRes.data.risks.find(r => r.type === "COMPLIANCE_EXPOSURE");
  assert.ok(compRisk);
  assert.match(compRisk.message, /Missing: KYC/);

  // 10. Student Analytics Isolation (no leak of Student B details to Student A)
  const studRes = await api("/api/student/analytics", { token: studentAToken });
  assert.equal(studRes.status, 200);
  // Student A only has occupancy 1 (which doesn't contain Student B's details)
  const isStudentBLeaked = studRes.data.facts.some(f => f.value === `Student B-${tag}`);
  assert.equal(isStudentBLeaked, false);

  // 11. Parent Child-Scope Isolation
  const parentRes = await api("/api/parent/analytics", { token: parentAToken });
  assert.equal(parentRes.status, 200);
  assert.equal(parentRes.data.length, 1);
  assert.equal(parentRes.data[0].studentId, studentA.id);

  // 12. Landlord unit ownership check
  const badLandlordRes = await api(`/api/landlord/unit/${unitA.id}/analytics`, { token: landlordBToken });
  assert.equal(badLandlordRes.status, 403); // Forbidden

  // 13. Admin Global Analytics
  const adminRes = await api("/api/admin/analytics", { token: adminToken });
  assert.equal(adminRes.status, 200);
  const globalUnits = adminRes.data.facts.find(f => f.type === "GLOBAL_UNITS_COUNT");
  assert.ok(globalUnits.value >= 2);
});
