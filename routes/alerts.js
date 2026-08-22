const express = require("express");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const { verifyToken } = require("../middlewares/auth");
const { transitionAlertStatus } = require("../services/alerts/alertManager");
const { evaluateGovernanceRules } = require("../services/governance/governanceEvaluator");

const router = express.Router();

// 1. GET /api/alerts - Fetch recipient-scoped alerts (paginated & filterable)
router.get("/api/alerts", verifyToken, async (req, res) => {
  try {
    const status = req.query.status;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const where = {
      recipientId: req.user.id,
    };

    if (status) {
      where.status = status;
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ]);

    return res.json({
      alerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// Helper for status transitions
async function handleTransition(req, res, nextStatus) {
  try {
    const alertId = Number(req.params.id);
    if (Number.isNaN(alertId)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const updated = await transitionAlertStatus(alertId, nextStatus, req.user.id, req.user.role);
    return res.json(updated);
  } catch (error) {
    if (error.message.includes("Forbidden") || error.message.includes("Unauthorized")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Invalid status transition")) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Failed to transition alert status" });
  }
}

// 2. PATCH /api/alerts/:id/read - Mark alert as READ
router.patch("/api/alerts/:id/read", verifyToken, async (req, res) => {
  return handleTransition(req, res, "READ");
});

// 3. PATCH /api/alerts/:id/acknowledge - Mark alert as ACKNOWLEDGED
router.patch("/api/alerts/:id/acknowledge", verifyToken, async (req, res) => {
  return handleTransition(req, res, "ACKNOWLEDGED");
});

// 4. PATCH /api/alerts/:id/resolve - Admin only resolver
router.patch("/api/alerts/:id/resolve", verifyToken, async (req, res) => {
  return handleTransition(req, res, "RESOLVED");
});

// 5. PATCH /api/alerts/:id/dismiss - Mark alert as DISMISSED
router.patch("/api/alerts/:id/dismiss", verifyToken, async (req, res) => {
  return handleTransition(req, res, "DISMISSED");
});

// 6. POST /api/internal/evaluate-governance - Internal authenticated platform evaluator endpoint
router.post("/api/internal/evaluate-governance", async (req, res) => {
  try {
    const received = req.headers["x-internal-token"] || "";
    const expected = process.env.INTERNAL_CRON_TOKEN || "default-cron-secret";

    // Timing-safe equal check (must pad/match buffer length to avoid length leaks)
    const recBuf = Buffer.alloc(expected.length);
    recBuf.write(received);
    const expBuf = Buffer.from(expected);

    if (!crypto.timingSafeEqual(recBuf, expBuf) || received.length !== expected.length) {
      return res.status(401).json({ error: "Unauthorized: Invalid internal cron token" });
    }

    const alerts = await evaluateGovernanceRules();
    return res.json({
      success: true,
      message: `Governance evaluation complete. Generated ${alerts.length} new alert(s).`,
      alertsCreated: alerts.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Governance evaluator failed" });
  }
});

module.exports = router;
