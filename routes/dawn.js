const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { callApi, getBearerToken } = require("../services/dawnIntents/utils");
const studentSearch = require("../services/dawnIntents/studentSearch");
const studentComplaintDraft = require("../services/dawnIntents/studentComplaintDraft");
const studentComplaintSummary = require("../services/dawnIntents/studentComplaintSummary");
const landlordRecurringIssues = require("../services/dawnIntents/landlordRecurringIssues");
const landlordRiskSummary = require("../services/dawnIntents/landlordRiskSummary");
const adminCorridorAnalytics = require("../services/dawnIntents/adminCorridorAnalytics");

const router = express.Router();

const intentMap = {
  student_search: studentSearch,
  student_complaint: studentComplaintDraft,
  student_complaint_summary: studentComplaintSummary,
  landlord_recurring: landlordRecurringIssues,
  landlord_risk: landlordRiskSummary,
  admin_density: adminCorridorAnalytics,
};

function inferIntent(role, message) {
  const text = String(message || "").toLowerCase().trim();

  if (role === "student") {
    if (
      text.includes("how is my unit") ||
      text.includes("unit doing") ||
      text.includes("unit health") ||
      text.includes("complaint summary")
    ) {
      return "student_complaint_summary";
    }
    if (
      text.includes("complaint") ||
      text.includes("leak") ||
      text.includes("water") ||
      text.includes("lift") ||
      text.includes("elevator") ||
      text.includes("issue")
    ) {
      return "student_complaint";
    }
    if (
      text.includes("show") ||
      text.includes("room") ||
      text.includes("unit") ||
      text.includes("ac") ||
      text.includes("rent") ||
      text.includes("near")
    ) {
      return "student_search";
    }
  }

  if (role === "landlord") {
    if (text.includes("recurring") || text.includes("top issues")) return "landlord_recurring";
    if (text.includes("at risk") || text.includes("risk summary") || text.includes("risk")) return "landlord_risk";
  }

  if (role === "admin") {
    if (text.includes("corridor") && text.includes("density")) return "admin_density";
    if (text.includes("highest complaint density")) return "admin_density";
  }

  return "unsupported";
}

function unsupportedMessageForRole(role) {
  if (role === "student") {
    return "Try: room search, complaint draft, or unit health summary.";
  }
  if (role === "landlord") {
    return "Try: top recurring issues or units at risk.";
  }
  if (role === "admin") {
    return "Try: corridor complaint density.";
  }
  return "No supported intents for this role.";
}

router.post("/dawn/query", verifyToken, async (req, res) => {
  try {
    const { message, confirm, action, intent: providedIntent } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const role = req.user.role;
    const intent = typeof providedIntent === "string" && providedIntent.trim() ? providedIntent.trim() : inferIntent(role, message);
    const handler = intentMap[intent];

    if (!handler) {
      return res.json({
        intent: "unsupported",
        assistant: unsupportedMessageForRole(role),
      });
    }

    const context = {
      token,
      message: message.trim(),
      text: message.toLowerCase().trim(),
      confirm: Boolean(confirm),
      action: action && typeof action === "object" ? action : null,
      callApi: (path, options = {}) => callApi(path, token, options),
    };

    const result = await handler({ req, context });
    return res.json({
      intent,
      ...(result || {}),
    });
  } catch (error) {
    if (error?.isHttpError) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Dawn request failed" });
    }
    console.error(error);
    return res.status(500).json({ error: error.message || "Dawn request failed" });
  }
});

module.exports = router;
