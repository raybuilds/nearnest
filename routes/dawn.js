const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { callApi, getBearerToken } = require("../services/dawnIntents/utils");
const studentSearch = require("../services/dawnIntents/studentSearch");
const studentComplaintDraft = require("../services/dawnIntents/studentComplaintDraft");
const studentComplaintSummary = require("../services/dawnIntents/studentComplaintSummary");
const studentUnitHealth = require("../services/dawnIntents/studentUnitHealth");
const corridorBehavioralInsight = require("../services/dawnIntents/corridorBehavioralInsight");
const landlordRecurringIssues = require("../services/dawnIntents/landlordRecurringIssues");
const landlordRiskSummary = require("../services/dawnIntents/landlordRiskSummary");
const landlordRemediationAdvisor = require("../services/dawnIntents/landlordRemediationAdvisor");
const adminCorridorAnalytics = require("../services/dawnIntents/adminCorridorAnalytics");
const explainUnitTrust = require("../services/dawnIntents/explainUnitTrust");
const { clearContext, getContext, updateContext } = require("../services/dawnContextStore");
const { formatDawnResponse } = require("../services/dawnResponseFormatter");
const { getUnitHealthReport } = require("../services/intelligence/dawnUnitHealthService");
const { getCorridorInsights } = require("../services/intelligence/dawnCorridorInsightService");
const { forecastUnitRisk } = require("../services/intelligence/dawnRiskForecastService");
const { generateOperationalInsights } = require("../services/intelligence/dawnOperationsAdvisor");

const router = express.Router();

const intentMap = {
  student_search: studentSearch,
  student_complaint: studentComplaintDraft,
  student_complaint_summary: studentComplaintSummary,
  student_unit_health: studentUnitHealth,
  predict_unit_risk: studentUnitHealth,
  operations_advisor: async ({ req, context }) => {
    const alerts = await generateOperationalInsights(req.user.role, req.user.id, {
      callApi: context.callApi,
    });

    context.updateMemory({
      lastIntent: "operations_advisor",
      lastUnitId: alerts[0]?.affectedUnits?.[0] || null,
    });

    return {
      message: "Here is the current operational advisory summary:",
      assistant: `Prepared ${alerts.length} operational insight alert(s).`,
      alerts,
      data: alerts,
    };
  },
  corridor_behavioral_insight: corridorBehavioralInsight,
  landlord_recurring: landlordRecurringIssues,
  landlord_risk: landlordRiskSummary,
  landlord_remediation_advisor: landlordRemediationAdvisor,
  admin_density: adminCorridorAnalytics,
  explain_unit_trust: explainUnitTrust,
};

function createDawnContext(req, token, memory) {
  const userId = req.user.id;

  return {
    token,
    message: "",
    text: "",
    confirm: false,
    action: null,
    memory,
    updateMemory: (patch) => updateContext(userId, patch),
    clearMemory: (field) => {
      if (!field) {
        clearContext(userId);
        return;
      }
      const current = getContext(userId);
      updateContext(userId, { ...current, [field]: null });
    },
    callApi: (path, options = {}) => callApi(path, token, options),
  };
}

function selectLandlordFocusUnit(units) {
  return [...units].sort((a, b) => {
    if (Number(b.complaintsLast30Days || 0) !== Number(a.complaintsLast30Days || 0)) {
      return Number(b.complaintsLast30Days || 0) - Number(a.complaintsLast30Days || 0);
    }
    if (Number(a.trustScore || 0) !== Number(b.trustScore || 0)) {
      return Number(a.trustScore || 0) - Number(b.trustScore || 0);
    }
    return Number(a.id || 0) - Number(b.id || 0);
  })[0] || null;
}

async function buildInsightContext(req, context) {
  if (req.user.role === "student") {
    const profile = await context.callApi("/profile");
    const summary = await studentComplaintSummary({ req, context });
    const data = summary?.data || {};

    return {
      userRole: "student",
      unit: data.unitId || profile?.occupancy?.currentUnit?.unitId || null,
      trustScore: data.trustScore,
      complaintsLast30Days: data.complaints30d,
      slaBreaches30Days: data.slaBreaches30d,
      unresolvedComplaints: data.openComplaints,
      corridorMetrics: null,
    };
  }

  if (req.user.role === "landlord") {
    const units = await context.callApi("/landlord/units");
    const focusUnit = selectLandlordFocusUnit(Array.isArray(units) ? units : []);

    return {
      userRole: "landlord",
      unit: focusUnit?.id || null,
      trustScore: focusUnit?.trustScore ?? null,
      complaintsLast30Days: focusUnit?.complaintsLast30Days ?? 0,
      slaBreaches30Days: focusUnit?.slaLateCount ?? 0,
      unresolvedComplaints: focusUnit?.activeComplaints ?? 0,
      corridorMetrics: null,
    };
  }

  if (req.user.role === "admin") {
    const analytics = await adminCorridorAnalytics({ req, context });
    const topCorridor = analytics?.data?.corridors?.[0] || null;

    return {
      userRole: "admin",
      unit: null,
      trustScore: null,
      complaintsLast30Days: topCorridor?.complaintDensity ?? 0,
      slaBreaches30Days: 0,
      unresolvedComplaints: 0,
      corridorMetrics: topCorridor
        ? {
            corridorId: topCorridor.corridorId,
            complaintDensityIncreasing: topCorridor?.trend14d?.current14d > topCorridor?.trend14d?.previous14d,
            current14d: topCorridor?.trend14d?.current14d ?? 0,
            previous14d: topCorridor?.trend14d?.previous14d ?? 0,
            unitsNearSuspension: topCorridor?.unitsNearSuspension ?? 0,
          }
        : null,
    };
  }

  return {
    userRole: req.user.role,
    unit: null,
    trustScore: null,
    complaintsLast30Days: 0,
    slaBreaches30Days: 0,
    unresolvedComplaints: 0,
    corridorMetrics: null,
  };
}

function uniqueNumbers(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value))
    )
  );
}

async function buildStudentInsightCards(req, context) {
  const profile = await context.callApi("/profile");
  const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  const occupantId =
    profile?.occupancy?.currentUnit?.occupantId ||
    profile?.identity?.currentOccupantId ||
    profile?.identity?.occupantId ||
    null;
  const corridorId =
    profile?.occupancy?.currentUnit?.corridor?.id ||
    profile?.identity?.corridor?.id ||
    profile?.currentAccommodation?.identity?.corridor?.id ||
    null;

  if (!unitId) {
    return [];
  }

  const [healthReport, riskForecast] = await Promise.all([
    getUnitHealthReport({
      userId: req.user.id,
      unitId,
      occupantId,
      corridorId,
      callApi: context.callApi,
    }),
    forecastUnitRisk(unitId),
  ]);

  const cards = [];
  if (healthReport.trustBand === "risk" || healthReport.slaBreaches30Days >= 2 || healthReport.unresolvedComplaints >= 2) {
    cards.push({
      type: "risk_alert",
      title: "Unit Health Warning",
      message: healthReport.summary,
      riskLevel: healthReport.trustBand === "risk" ? "HIGH" : "MEDIUM",
      affectedUnits: [unitId],
      indicators: healthReport.riskSignals,
    });
  }

  if (healthReport.trend === "declining" || riskForecast.riskLevel !== "STABLE") {
    cards.push({
      type: "trend_alert",
      title: "Complaint Trend Alert",
      message:
        riskForecast.riskLevel === "CRITICAL"
          ? "Your unit is showing critical early warning signals."
          : "Complaint and response signals suggest this unit should be monitored.",
      riskLevel: riskForecast.riskLevel,
      affectedUnits: [unitId],
      indicators: riskForecast.indicators,
      recommendation: riskForecast.recommendation,
    });
  }

  return cards;
}

async function buildLandlordInsightCards(context) {
  const [units, complaintsPayload] = await Promise.all([
    context.callApi("/landlord/units"),
    context.callApi("/complaints"),
  ]);

  const unitList = Array.isArray(units) ? units : [];
  const complaints = Array.isArray(complaintsPayload?.complaints) ? complaintsPayload.complaints : [];

  const riskForecasts = await Promise.all(
    unitList.slice(0, 6).map(async (unit) => {
      try {
        return await forecastUnitRisk(unit.id);
      } catch {
        return null;
      }
    })
  );

  const atRiskUnits = riskForecasts
    .filter((item) => item && item.riskLevel !== "STABLE")
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  const cards = [];
  if (atRiskUnits.length > 0) {
    cards.push({
      type: "risk_alert",
      title: "Units At Risk",
      message: `${atRiskUnits.length} unit(s) are showing early warning or critical risk signals.`,
      riskLevel: atRiskUnits.some((item) => item.riskLevel === "CRITICAL") ? "HIGH" : "MEDIUM",
      affectedUnits: atRiskUnits.map((item) => item.unitId),
      indicators: atRiskUnits.flatMap((item) => item.indicators).slice(0, 5),
    });
  }

  const recurringIssues = new Map();
  complaints.forEach((complaint) => {
    const key = complaint.incidentType || "other";
    const current = recurringIssues.get(key) || { count: 0, unitIds: [] };
    current.count += 1;
    current.unitIds.push(complaint.unitId);
    recurringIssues.set(key, current);
  });

  const topRecurring = Array.from(recurringIssues.entries())
    .map(([incidentType, payload]) => ({
      incidentType,
      count: payload.count,
      unitIds: uniqueNumbers(payload.unitIds),
    }))
    .sort((a, b) => b.count - a.count)[0];

  if (topRecurring && topRecurring.count >= 2) {
    cards.push({
      type: "pattern_alert",
      title: "Recurring Issues",
      message: `${topRecurring.incidentType} complaints are recurring across your portfolio.`,
      riskLevel: topRecurring.count >= 3 ? "HIGH" : "MEDIUM",
      affectedUnits: topRecurring.unitIds,
      indicators: [`${topRecurring.count} recent ${topRecurring.incidentType} complaints detected`],
    });
  }

  return cards;
}

async function buildAdminInsightCards(context) {
  const corridors = await context.callApi("/corridors").catch(() => []);
  const cards = [];

  for (const corridor of Array.isArray(corridors) ? corridors : []) {
    const report = await getCorridorInsights(corridor.id, { callApi: context.callApi }).catch(() => null);
    if (!report) continue;

    const current14d = Number(report.trend14d?.current14d || 0);
    const previous14d = Number(report.trend14d?.previous14d || 0);
    if (current14d > previous14d || report.complaintDensity >= 2) {
      cards.push({
        type: "risk_alert",
        title: "Rising Complaint Density",
        message: `Complaint activity is rising in corridor ${corridor.name}.`,
        riskLevel: report.riskLevel === "HIGH" ? "HIGH" : "MEDIUM",
        affectedUnits: uniqueNumbers((report.trustScores || []).filter((item) => Number(item.trustScore) < 55).map((item) => item.unitId)),
        indicators: [
          `Complaint density ${report.complaintDensity}`,
          `${report.unitsNearSuspension} units near suspension`,
        ],
      });
    }

    const safetyClusterCount =
      Number(report.incidentFrequency.fire || 0) +
      Number(report.incidentFrequency.safety || 0) +
      Number(report.incidentFrequency.electrical || 0) +
      Number(report.severeIncidents || 0);

    if (safetyClusterCount >= 2) {
      cards.push({
        type: "risk_alert",
        title: "Safety Incident Cluster",
        message: `Safety-related incidents are clustering in corridor ${corridor.name}.`,
        riskLevel: safetyClusterCount >= 4 ? "HIGH" : "MEDIUM",
        affectedUnits: uniqueNumbers((report.trustScores || []).filter((item) => Number(item.trustScore) < 60).map((item) => item.unitId)),
        indicators: [
          `${Number(report.incidentFrequency.fire || 0)} fire complaints`,
          `${Number(report.incidentFrequency.electrical || 0)} electrical complaints`,
          `${Number(report.incidentFrequency.safety || 0)} safety complaints`,
        ].filter((item) => !item.startsWith("0 ")),
      });
    }
  }

  return cards.slice(0, 6);
}

async function buildProactiveInsightCards(req, context) {
  if (req.user.role === "student") {
    return buildStudentInsightCards(req, context);
  }
  if (req.user.role === "landlord") {
    return buildLandlordInsightCards(context);
  }
  if (req.user.role === "admin") {
    return buildAdminInsightCards(context);
  }
  return [];
}

function inferIntent(role, message) {
  const text = String(message || "").toLowerCase().trim();

  if (
    text.includes("explain trust score") ||
    text.includes("why is this unit trust low") ||
    text.includes("why trust score dropped") ||
    text.includes("why is unit trust low")
  ) {
    return "explain_unit_trust";
  }

  if (role === "student") {
    if (
      text.includes("how is the housing system doing") ||
      text.includes("any operational problems")
    ) {
      return "operations_advisor";
    }
    if (
      text.includes("problems in my corridor") ||
      text.includes("corridor issues") ||
      text.includes("corridor health") ||
      text.includes("which corridor has problems")
    ) {
      return "corridor_behavioral_insight";
    }
    if (
      text.includes("is my housing safe") ||
      text.includes("is this unit risky") ||
      text.includes("is my room safe") ||
      text.includes("unit risk") ||
      text.includes("housing risk")
    ) {
      return "predict_unit_risk";
    }
    if (
      text.includes("how is my housing") ||
      text.includes("how is my room doing") ||
      text.includes("give me a health report") ||
      text.includes("unit health") ||
      text.includes("housing health")
    ) {
      return "student_unit_health";
    }
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
      text.includes("electric") ||
      text.includes("electrical") ||
      text.includes("wiring") ||
      text.includes("fire") ||
      text.includes("smoke") ||
      text.includes("plumbing") ||
      text.includes("bathroom") ||
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
    if (
      text.includes("how is the housing system doing") ||
      text.includes("any operational problems")
    ) {
      return "operations_advisor";
    }
    if (
      text.includes("what should i fix") ||
      text.includes("what problems should i fix") ||
      text.includes("what problems should i address first") ||
      text.includes("which units need attention")
    ) {
      return "landlord_remediation_advisor";
    }
    if (text.includes("recurring") || text.includes("top issues")) return "landlord_recurring";
    if (text.includes("at risk") || text.includes("risk summary") || text.includes("risk")) return "landlord_risk";
  }

  if (role === "admin") {
    if (
      text.includes("which units need attention") ||
      text.includes("how is the housing system doing") ||
      text.includes("any operational problems")
    ) {
      return "operations_advisor";
    }
    if (text.includes("corridor") && text.includes("density")) return "admin_density";
    if (text.includes("highest complaint density")) return "admin_density";
  }

  return "unsupported";
}

function unsupportedMessageForRole(role) {
  if (role === "student") {
    return "Try: room search, complaint draft, unit health report, operations advisor, corridor issues, unit health summary, or trust explanation.";
  }
  if (role === "landlord") {
    return "Try: operations advisor, corridor issues, top recurring issues, units at risk, or trust explanation.";
  }
  if (role === "admin") {
    return "Try: operations advisor, corridor issues, corridor complaint density, or trust explanation.";
  }
  return "No supported intents for this role.";
}

router.get("/dawn/insights", verifyToken, async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const context = createDawnContext(req, token, getContext(req.user.id));
    const insightContext = await buildInsightContext(req, context);
    const insights = await buildProactiveInsightCards(req, context);

    return res.json({
      role: req.user.role,
      unit: insightContext.unit,
      trustScore: insightContext.trustScore,
      insights,
    });
  } catch (error) {
    if (error?.isHttpError) {
      return res.status(error.statusCode || 500).json({ error: error.message || "Dawn insights failed" });
    }
    console.error(error);
    return res.status(500).json({ error: error.message || "Dawn insights failed" });
  }
});

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
    const userId = req.user.id;
    const memory = getContext(userId);

    const shouldClearContext = /^\/?(clear|reset)\s+(memory|context)$/i.test(message.trim());
    if (shouldClearContext) {
      clearContext(userId);
      return res.json({
        intent: "context_reset",
        assistant: "Context cleared. We can start fresh.",
      });
    }

    let inferredIntent = inferIntent(role, message);
    if (inferredIntent === "unsupported" && memory?.lastIntent) {
      inferredIntent = memory.lastIntent;
    }

    const intent = typeof providedIntent === "string" && providedIntent.trim() ? providedIntent.trim() : inferredIntent;
    const handler = intentMap[intent];

    if (!handler) {
      return res.json({
        intent: "unsupported",
        assistant: unsupportedMessageForRole(role),
      });
    }

    const context = {
      ...createDawnContext(req, token, memory),
      message: message.trim(),
      text: message.toLowerCase().trim(),
      confirm: Boolean(confirm),
      action: action && typeof action === "object" ? action : null,
      intent,
    };

    const result = await handler({ req, context });
    updateContext(userId, {
      lastIntent: intent,
      ...(result?.data?.unitId ? { lastUnitId: result.data.unitId } : {}),
    });

    const assistant = formatDawnResponse(intent, result || {});
    return res.json({
      intent,
      ...(result || {}),
      assistant,
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
