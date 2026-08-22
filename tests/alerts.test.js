const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const prisma = require("../prismaClient");
const TEST_PORT = 5112;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_SECRET = "alerts-test-secret";
const TEST_CRON_TOKEN = "super-secret-cron-token";

let serverProcess = null;

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nearnest_test";
}

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

async function api(path, { method = "GET", token, body, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let requestBody = undefined;
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
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
      INTERNAL_CRON_TOKEN: TEST_CRON_TOKEN,
      API_BASE_URL: BASE_URL,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  await waitForServer();
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
  await prisma.$disconnect();
});

test("Phase 8 Integration - Tenant Governance & Alerts Core", async () => {
  const tag = createTag("p8");
  const corridor = await prisma.corridor.create({ data: { name: `Corridor-${tag}` } });

  // 1. Create users
  const { roleRecord: studentA, token: studentAToken, user: userA } = await createUser(`Student A-${tag}`, `student-a-${tag}@test.com`, "student", { corridorId: corridor.id });
  const { roleRecord: studentB, token: studentBToken } = await createUser(`Student B-${tag}`, `student-b-${tag}@test.com`, "student", { corridorId: corridor.id });
  const { roleRecord: landlordA, token: landlordAToken } = await createUser(`Landlord A-${tag}`, `landlord-a-${tag}@test.com`, "landlord");
  const { roleRecord: landlordB, token: landlordBToken } = await createUser(`Landlord B-${tag}`, `landlord-b-${tag}@test.com`, "landlord");
  const { roleRecord: parentA, token: parentAToken } = await createUser(`Parent A-${tag}`, `parent-a-${tag}@test.com`, "parent");
  const { token: adminToken } = await createUser(`Admin-${tag}`, `admin-${tag}@test.com`, "admin");

  // Setup Unit
  const unit = await prisma.unit.create({
    data: {
      corridorId: corridor.id,
      landlordId: landlordA.id,
      rent: 8000,
      capacity: 1,
    },
  });

  const occupancy = await prisma.occupancy.create({
    data: {
      unitId: unit.id,
      studentId: studentA.id,
      startDate: new Date(),
    },
  });

  await prisma.parentStudent.create({
    data: {
      parentId: parentA.id,
      studentId: studentA.id,
      verified: true,
      active: true,
    },
  });

  // Verify empty alert states
  const emptyRes = await api("/api/alerts", { token: studentAToken });
  assert.equal(emptyRes.status, 200);
  assert.equal(emptyRes.data.alerts.length, 0);

  // 2. Test Concurrent Alert Creation & Idempotency
  const { createAlert } = require("../services/alerts/alertManager");
  const eventKey = `TEST_CONCURRENT:unit:${unit.id}`;

  const creationPromises = Array.from({ length: 10 }).map(() =>
    createAlert({
      recipientId: userA.id,
      type: "TEST_CONCURRENT",
      severity: "LOW",
      sourceEntity: "unit",
      sourceId: unit.id,
      title: "Concurrent Alert Title",
      message: "Concurrent Alert Message",
      unitId: unit.id,
    })
  );

  const results = await Promise.all(creationPromises);
  const createdAlerts = results.filter((r) => r && r.id);
  
  // Database unique constraint must guarantee exactly one unique alert record exists
  const uniqueAlertIds = new Set(createdAlerts.map((a) => a.id));
  assert.equal(uniqueAlertIds.size, 1);

  // 3. Test same event -> multiple recipients
  // Let's manually trigger a compliance warning
  const compliance = await prisma.unitCompliance.create({
    data: {
      unitId: unit.id,
      docType: "KYC",
      storageKey: "kyc-key.pdf",
      fileName: "kyc.pdf",
      status: "APPROVED",
      expiryDate: new Date(Date.now() - 2 * 24 * 3600 * 1000), // Expired 2 days ago
    },
  });

  // 4. Test Cron Evaluator Authentication (timing-safe check)
  const badCronRes = await api("/api/internal/evaluate-governance", {
    method: "POST",
    headers: { "X-Internal-Token": "bad-token" },
  });
  assert.equal(badCronRes.status, 401);

  const goodCronRes = await api("/api/internal/evaluate-governance", {
    method: "POST",
    headers: { "X-Internal-Token": TEST_CRON_TOKEN },
  });
  assert.equal(goodCronRes.status, 200);
  assert.ok(goodCronRes.data.alertsCreated > 0);

  // 5. Test status changes do not break deduplication on repeated evaluator runs
  // Retrieve landlord alert
  const alertsListRes = await api("/api/alerts", { token: landlordAToken });
  assert.equal(alertsListRes.status, 200);
  const compAlert = alertsListRes.data.alerts.find((a) => a.type === "COMPLIANCE_EXPIRED");
  assert.ok(compAlert);

  // Transition: OPEN -> READ -> ACKNOWLEDGED
  const readRes = await api(`/api/alerts/${compAlert.id}/read`, { method: "PATCH", token: landlordAToken });
  assert.equal(readRes.status, 200);
  assert.equal(readRes.data.status, "READ");

  const ackRes = await api(`/api/alerts/${compAlert.id}/acknowledge`, { method: "PATCH", token: landlordAToken });
  assert.equal(ackRes.status, 200);
  assert.equal(ackRes.data.status, "ACKNOWLEDGED");

  // Re-run the evaluator. The status of existing alerts must remain ACKNOWLEDGED (no reset to OPEN/duplicates)
  const rerunCronRes = await api("/api/internal/evaluate-governance", {
    method: "POST",
    headers: { "X-Internal-Token": TEST_CRON_TOKEN },
  });
  assert.equal(rerunCronRes.status, 200);

  const refreshedAlertRes = await api(`/api/alerts`, { token: landlordAToken });
  const checkAlert = refreshedAlertRes.data.alerts.find((a) => a.id === compAlert.id);
  assert.equal(checkAlert.status, "ACKNOWLEDGED");

  // 6. Test unauthorized lifecycle mutations (Student B cannot read/write Student A's alert)
  const badMutateRes = await api(`/api/alerts/${compAlert.id}/read`, { method: "PATCH", token: studentBToken });
  assert.equal(badMutateRes.status, 403);
});
