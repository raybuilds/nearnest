const express = require("express");
const { verifyToken } = require("../middlewares/auth");
const { callApi, getBearerToken, parseRequestedUnitId, preprocessDawnText } = require("../services/dawnIntents/utils");
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
const { formatDawnResponse, normalizeResponse } = require("../services/dawnResponseFormatter");
const { getUnitHealthReport } = require("../services/intelligence/dawnUnitHealthService");
const { getCorridorInsights } = require("../services/intelligence/dawnCorridorInsightService");
const { forecastUnitRisk } = require("../services/intelligence/dawnRiskForecastService");
const { generateOperationalInsights } = require("../services/intelligence/dawnOperationsAdvisor");
const { explainTrust } = require("../services/intelligence/trustExplanationService");

const router = express.Router();

const intentMap = {
  student_search: studentSearch,
  student_complaint: studentComplaintDraft,
  student_complaint_summary: studentComplaintSummary,
  student_unit_health: studentUnitHealth,
  predict_unit_risk: studentUnitHealth,
  recommend_unit_decision: recommendUnitDecision,
  compare_units: compareUnits,
  system_health_summary: systemHealthSummary,
  operations_advisor: async ({ req, context }) => {
    const alerts = await generateOperationalInsights(req.user.role, req.user.id, {
      callApi: context.callApi,
    });
    const wrappedAlerts = wrapOperationsAlerts(alerts, req.user.role);

    context.updateMemory({
      lastIntent: "operations_advisor",
      lastUnitId: wrappedAlerts[0]?.affectedUnits?.[0] || null,
    });

    return {
      message: "Here is the current operational advisory summary:",
      assistant: `Prepared ${wrappedAlerts.length} operational insight alert(s).`,
      alerts: wrappedAlerts,
      data: {
        alerts: wrappedAlerts,
        units: wrappedAlerts.flatMap((item) => item.units || []),
        corridors: wrappedAlerts.flatMap((item) => item.corridors || []),
      },
    };
  },
  corridor_behavioral_insight: corridorBehavioralInsight,
  landlord_recurring: landlordRecurringIssues,
  landlord_risk: landlordRiskSummary,
  landlord_remediation_advisor: landlordRemediationAdvisor,
  admin_density: adminCorridorAnalytics,
  explain_unit_trust: explainUnitTrust,
  explain_unit_overview: explainUnitOverview,
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

function buildComplaintCountFromProfile(profile) {
  return Number(
    profile?.currentAccommodation?.complaintHealth?.openComplaints30d ??
      profile?.currentAccommodation?.complaintHealth?.totalComplaints30d ??
      profile?.currentAccommodation?.trust?.complaintDensity30d ??
      0
  );
}

async function buildResolvedContext(req, context) {
  const hintedUnitId = Number(context?.hintedUnitId);
  const hintedCorridorId = Number(context?.hintedCorridorId);
  const resolvedHintedUnitId = Number.isNaN(hintedUnitId) ? null : hintedUnitId;
  const resolvedHintedCorridorId = Number.isNaN(hintedCorridorId) ? null : hintedCorridorId;

  if (req.user.role === "student") {
    const profile = await context.callApi("/profile");
    const currentUnit = profile?.occupancy?.currentUnit || {};
    const accommodation = profile?.currentAccommodation || {};

    return {
      role: "student",
      corridorId:
        resolvedHintedCorridorId ||
        currentUnit?.corridor?.id ||
        profile?.identity?.corridor?.id ||
        accommodation?.identity?.corridor?.id ||
        context.memory?.lastCorridorId ||
        null,
      unitId:
        resolvedHintedUnitId ||
        currentUnit?.unitId ||
        accommodation?.identity?.unitId ||
        context.memory?.lastUnitId ||
        null,
      trustScore:
        accommodation?.trust?.trustScore ??
        accommodation?.complaintHealth?.trustScore ??
        context.memory?.lastKnownTrustScore ??
        null,
      activeComplaintsCount: buildComplaintCountFromProfile(profile),
      profile,
    };
  }

  if (req.user.role === "landlord") {
    const units = await context.callApi("/landlord/units").catch(() => []);
    const focusUnit = selectLandlordFocusUnit(Array.isArray(units) ? units : []);
    return {
      role: "landlord",
      corridorId: resolvedHintedCorridorId || focusUnit?.corridorId || context.memory?.lastCorridorId || null,
      unitId: resolvedHintedUnitId || focusUnit?.id || context.memory?.lastUnitId || null,
      trustScore: focusUnit?.trustScore ?? context.memory?.lastKnownTrustScore ?? null,
      activeComplaintsCount: Number(focusUnit?.activeComplaints ?? 0),
      focusUnit,
    };
  }

  if (req.user.role === "admin") {
    const analytics = await adminCorridorAnalytics({ req, context }).catch(() => null);
    const topCorridor = analytics?.data?.corridors?.[0] || null;
    return {
      role: "admin",
      corridorId: resolvedHintedCorridorId || topCorridor?.corridorId || context.memory?.lastCorridorId || null,
      unitId: resolvedHintedUnitId || context.memory?.lastUnitId || null,
      trustScore: null,
      activeComplaintsCount: Number(topCorridor?.complaintDensity ?? 0),
      corridorAnalytics: topCorridor,
    };
  }

  return {
    role: req.user.role,
    corridorId: resolvedHintedCorridorId || context.memory?.lastCorridorId || null,
    unitId: resolvedHintedUnitId || context.memory?.lastUnitId || null,
    trustScore: context.memory?.lastKnownTrustScore || null,
    activeComplaintsCount: context.memory?.lastKnownComplaintCount || 0,
  };
}

async function explainUnitOverview({ req, context }) {
  const explicitUnitId = parseRequestedUnitId(context.message) ?? parseRequestedUnitId(context.text);
  const unitId = explicitUnitId || context.resolvedContext?.unitId || context.memory?.lastUnitId || null;
  const corridorId = context.resolvedContext?.corridorId || context.memory?.lastCorridorId || null;

  if (!unitId) {
    return {
      message: "Please specify a unit to explain.",
      assistant: "I need a unit reference before I can explain its trust, complaint history, and forecast.",
      data: {
        missing: "unitId",
      },
    };
  }

  const [trust, healthReport, riskForecast] = await Promise.all([
    explainTrust(unitId, { callApi: context.callApi }),
    getUnitHealthReport({
      unitId,
      corridorId,
      callApi: context.callApi,
    }),
    forecastUnitRisk(unitId),
  ]);

  context.updateMemory({
    lastIntent: "explain_unit_overview",
    lastUnitId: unitId,
    lastViewedUnitId: unitId,
    lastKnownTrustScore: trust?.trustScore ?? healthReport?.trustScore ?? null,
    lastKnownComplaintCount: healthReport?.complaintsLast30Days ?? null,
    lastKnownRiskLevel: riskForecast?.riskLevel ?? null,
  });

  return {
    message: `Here is the full explanation for Unit ${unitId}.`,
    data: {
      unitId,
      corridorId,
      trust,
      healthReport,
      riskForecast,
      trustScore: trust?.trustScore ?? healthReport?.trustScore ?? null,
      complaintCount: healthReport?.complaintsLast30Days ?? 0,
      riskLevel: riskForecast?.riskLevel ?? "STABLE",
    },
  };
}

async function buildStudentDecisionSnapshot(unitId, context) {
  try {
    const [details, riskForecast] = await Promise.all([
      context.callApi(`/student/unit/${unitId}/details`),
      forecastUnitRisk(unitId),
    ]);

    const trustSignals = details?.trustSignals || {};
    const complaintSummary = trustSignals?.complaintSummary || {};

    return {
      unitId,
      trustScore: Number(trustSignals?.trustScore ?? 0),
      trustBand: trustSignals?.trustBand || null,
      complaints: Number(complaintSummary?.complaintsLast30Days ?? 0),
      activeComplaints: Number(complaintSummary?.activeComplaints ?? 0),
      riskLevel: riskForecast?.riskLevel || "STABLE",
      riskIndicators: Array.isArray(riskForecast?.indicators) ? riskForecast.indicators : [],
      discovery: details?.discovery || {},
      recommendation: riskForecast?.recommendation || "Review this unit before making a decision.",
    };
  } catch {
    const [trust, riskForecast, complaintPayload] = await Promise.all([
      explainTrust(unitId, { callApi: context.callApi }).catch(() => ({ trustScore: 0 })),
      forecastUnitRisk(unitId).catch(() => ({ riskLevel: "STABLE", indicators: [], recommendation: "Review this unit before making a decision." })),
      context.callApi(`/unit/${unitId}/complaints`).catch(() => ({ summary: {} })),
    ]);
    const complaintSummary = complaintPayload?.summary || {};

    return {
      unitId,
      trustScore: Number(trust?.trustScore ?? 0),
      trustBand: null,
      complaints: Number(complaintSummary?.complaintsLast30Days ?? 0),
      activeComplaints: Number(complaintSummary?.activeComplaints ?? 0),
      riskLevel: riskForecast?.riskLevel || "STABLE",
      riskIndicators: Array.isArray(riskForecast?.indicators) ? riskForecast.indicators : [],
      discovery: {},
      recommendation: riskForecast?.recommendation || "Review this unit before making a decision.",
    };
  }
}

async function recommendUnitDecision({ req, context }) {
  if (req.user.role !== "student") {
    return {
      message: "I couldn’t fully resolve that. Try specifying a unit or corridor.",
      data: {
        missing: "student_context",
      },
    };
  }

  const explicitUnitId = parseRequestedUnitId(context.message) ?? parseRequestedUnitId(context.text);
  const unitId = explicitUnitId || context.resolvedContext?.unitId || context.memory?.lastUnitId || null;

  if (!unitId) {
    return {
      message: "I couldn’t fully resolve that. Try specifying a unit or corridor.",
      data: {
        missing: "unitId",
      },
    };
  }

  const snapshot = await buildStudentDecisionSnapshot(unitId, context);
  const trustScore = snapshot.trustScore;
  const riskLevel = snapshot.riskLevel;
  const reasons = [
    trustScore !== null && trustScore !== undefined ? `trust score ${trustScore}` : null,
    Number(snapshot.complaints || 0) > 0 ? `${snapshot.complaints} complaints in the last 30 days` : null,
    riskLevel ? `risk level ${riskLevel}` : null,
    ...(snapshot.riskIndicators || []).slice(0, 2),
  ].filter(Boolean);

  let verdict = "CONDITIONAL";
  let recommendation = "Review the trust breakdown and recent complaint history before choosing this unit.";

  if ((trustScore !== null && trustScore >= 70) && (riskLevel === "LOW" || riskLevel === "STABLE")) {
    verdict = "RECOMMENDED";
    recommendation = "You should verify the latest complaints and then move ahead if the unit still matches your budget and distance needs.";
  } else if ((trustScore !== null && trustScore < 45) || riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    verdict = "AVOID";
    recommendation = "You should choose a safer unit or wait for this unit’s trust and complaint signals to improve.";
  }

  context.updateMemory({
    lastIntent: "recommend_unit_decision",
    lastUnitId: unitId,
    lastViewedUnitId: unitId,
    lastKnownTrustScore: trustScore,
    lastKnownComplaintCount: snapshot.complaints ?? null,
    lastKnownRiskLevel: riskLevel,
  });

  return {
    message: `Here is the decision guidance for Unit ${unitId}.`,
    data: {
      unitId,
      trustScore,
      riskLevel,
      verdict,
      recommendation,
      reasons,
      complaints: snapshot.complaints,
      activeComplaints: snapshot.activeComplaints,
      discovery: snapshot.discovery,
    },
  };
}

function parseRequestedUnitIds(...values) {
  const ids = [];
  const pattern = /\b(?:unit|room)\s*#?\s*(\d+)\b/gi;

  values.forEach((value) => {
    const text = String(value || "");
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = Number(match[1]);
      if (!Number.isNaN(id)) ids.push(id);
    }
  });

  return Array.from(new Set(ids));
}

async function compareUnits({ req, context }) {
  if (req.user.role !== "student") {
    return {
      message: "I couldn’t fully resolve that. Try specifying a unit or corridor.",
      data: {
        missing: "student_context",
      },
    };
  }

  const explicitUnitIds = parseRequestedUnitIds(context.message, context.text);
  const candidateIds = [...explicitUnitIds];
  if (candidateIds.length === 1 && context.memory?.lastUnitId && !candidateIds.includes(Number(context.memory.lastUnitId))) {
    candidateIds.unshift(Number(context.memory.lastUnitId));
  }

  const unitIds = candidateIds.slice(0, 2);
  if (unitIds.length < 2) {
    return {
      message: "I couldn’t fully resolve that. Try specifying a unit or corridor.",
      data: {
        missing: "unitIds",
      },
    };
  }

  const [left, right] = await Promise.all(unitIds.map((unitId) => buildStudentDecisionSnapshot(unitId, context)));
  const scoreFor = (item) =>
    Number(item.trustScore || 0) * 2 - Number(item.complaints || 0) * 5 - (String(item.riskLevel) === "CRITICAL" ? 30 : String(item.riskLevel) === "HIGH" ? 20 : 0);
  const leftScore = scoreFor(left);
  const rightScore = scoreFor(right);
  const winner = leftScore >= rightScore ? left : right;

  context.updateMemory({
    lastIntent: "compare_units",
    lastUnitId: winner.unitId,
    lastViewedUnitId: winner.unitId,
    lastKnownTrustScore: winner.trustScore,
    lastKnownComplaintCount: winner.complaints,
    lastKnownRiskLevel: winner.riskLevel,
  });

  return {
    message: `Here is the comparison for Units ${left.unitId} and ${right.unitId}.`,
    data: {
      units: [left, right],
      recommendation: winner.unitId,
      verdict:
        leftScore === rightScore
          ? "Both units are closely matched. Use rent and distance to break the tie."
          : `Unit ${winner.unitId} is the stronger option based on trust, complaints, and risk.`,
      reasons: [
        `Unit ${winner.unitId} has the stronger combined trust and risk profile.`,
      ],
    },
  };
}

async function systemHealthSummary({ req, context }) {
  if (req.user.role === "student") {
    const profile = await context.callApi("/profile");
    const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
    const occupantId =
      profile?.occupancy?.currentUnit?.occupantId || profile?.identity?.currentOccupantId || profile?.identity?.occupantId || null;
    const corridorId =
      profile?.occupancy?.currentUnit?.corridor?.id || profile?.identity?.corridor?.id || profile?.currentAccommodation?.identity?.corridor?.id || null;
    const [healthReport, riskForecast] = await Promise.all([
      getUnitHealthReport({ userId: req.user.id, unitId, occupantId, corridorId, callApi: context.callApi }),
      forecastUnitRisk(unitId),
    ]);

    return {
      message: "Here is the current system health summary for your housing:",
      data: {
        role: "student",
        unitId,
        trustScore: healthReport.trustScore,
        complaintCount: healthReport.complaintsLast30Days,
        riskLevel: riskForecast.riskLevel,
        summary: healthReport.summary,
      },
    };
  }

  if (req.user.role === "landlord") {
    const units = await context.callApi("/landlord/units");
    const unitList = Array.isArray(units) ? units : [];
    const forecasts = await Promise.all(unitList.map((unit) => forecastUnitRisk(unit.id).catch(() => null)));
    const riskDistribution = forecasts.reduce(
      (acc, forecast) => {
        const level = String(forecast?.riskLevel || "STABLE");
        const key = level === "CRITICAL" || level === "HIGH" ? "high" : level === "EARLY_WARNING" || level === "MEDIUM" ? "medium" : "low";
        acc[key] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );

    return {
      message: "Here is the current system health summary for your portfolio:",
      data: {
        role: "landlord",
        totalUnits: unitList.length,
        activeComplaints: unitList.reduce((sum, unit) => sum + Number(unit.activeComplaints || 0), 0),
        riskDistribution,
        summary: `You manage ${unitList.length} units. ${riskDistribution.high} high-risk, ${riskDistribution.medium} medium-risk, and ${riskDistribution.low} lower-risk units are active right now.`,
      },
    };
  }

  const corridors = await context.callApi("/corridors").catch(() => []);
  const reports = (
    await Promise.all((Array.isArray(corridors) ? corridors : []).map(async (corridor) => ({
      corridor,
      report: await getCorridorInsights(corridor.id, { callApi: context.callApi }).catch(() => null),
    })))
  ).filter((item) => item.report);
  const riskyCorridors = reports
    .filter((item) => item.report.riskLevel === "HIGH" || Number(item.report.complaintDensity || 0) >= 2)
    .sort((a, b) => Number(b.report.complaintDensity || 0) - Number(a.report.complaintDensity || 0))
    .slice(0, 3)
    .map((item) => ({
      corridorId: item.corridor.id,
      corridorName: item.corridor.name,
      complaintDensity: item.report.complaintDensity,
      riskLevel: item.report.riskLevel,
    }));
  const topIssues = reports
    .flatMap((item) => Object.entries(item.report.incidentFrequency || {}).map(([incidentType, count]) => ({ incidentType, count })))
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .slice(0, 3);

  return {
    message: "Here is the current system health summary across NearNest:",
    data: {
      role: "admin",
      topIssues,
      riskyCorridors,
      summary: `The main issues right now are ${topIssues.map((item) => item.incidentType).join(", ") || "not significant"}.`,
    },
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

function buildAlertActions(role, alert) {
  const firstUnitId = Array.isArray(alert?.affectedUnits) && alert.affectedUnits.length > 0 ? alert.affectedUnits[0] : null;
  if (role === "student") {
    return [
      { label: "View complaints", query: "show complaints" },
      { label: "Check risk", query: "why is it risky?" },
      { label: "Take action", query: "report an issue" },
    ];
  }
  if (role === "landlord") {
    return [
      { label: "Take action", query: "what should I fix first?" },
      { label: "Show recurring issues", query: "show recurring issues" },
      ...(firstUnitId ? [{ label: "Explain this unit", query: `explain unit ${firstUnitId}` }] : []),
    ];
  }
  return [
    { label: "Units needing attention", query: "units needing attention" },
    { label: "Take action", query: "how is the housing system doing right now" },
    { label: "Risky corridors", query: "which corridor is risky?" },
  ];
}

function decorateInsightAlert(alert, role) {
  const firstUnitId = Array.isArray(alert?.affectedUnits) && alert.affectedUnits.length > 0 ? alert.affectedUnits[0] : null;
  return {
    ...alert,
    severity: alert?.riskLevel || "LOW",
    unitId: firstUnitId,
    actions: buildAlertActions(role, alert),
  };
}

function wrapOperationsAlerts(alerts, role) {
  return (Array.isArray(alerts) ? alerts : []).map((alert) => {
    const topUnit = Array.isArray(alert?.units) ? alert.units[0] : null;
    const topCorridor = Array.isArray(alert?.corridors) ? alert.corridors[0] : null;
    return {
      ...decorateInsightAlert(alert, role),
      priority: alert?.riskLevel || "LOW",
      action: topUnit?.recommendation || topCorridor?.recommendation || "Review the current operating signals now.",
      reason:
        (Array.isArray(topUnit?.indicators) && topUnit.indicators[0]) ||
        (Array.isArray(topCorridor?.indicators) && topCorridor.indicators[0]) ||
        alert?.message ||
        "Operational pressure detected.",
    };
  });
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
    return (await buildStudentInsightCards(req, context)).map((item) => decorateInsightAlert(item, req.user.role));
  }
  if (req.user.role === "landlord") {
    return (await buildLandlordInsightCards(context)).map((item) => decorateInsightAlert(item, req.user.role));
  }
  if (req.user.role === "admin") {
    return (await buildAdminInsightCards(context)).map((item) => decorateInsightAlert(item, req.user.role));
  }
  return [];
}

function inferIntent(role, message) {
  const text = String(message || "").toLowerCase().trim();

  if (
    text.includes("explain this unit") ||
    text.includes("explain unit") ||
    text.includes("full unit explanation")
  ) {
    return "explain_unit_overview";
  }

  if (
    text.includes("explain trust score") ||
    text.includes("why is this unit trust low") ||
    text.includes("why trust score dropped") ||
    text.includes("why is unit trust low")
  ) {
    return "explain_unit_trust";
  }

  if (
    text.includes("system health summary") ||
    text.includes("system health") ||
    text.includes("health summary")
  ) {
    return "system_health_summary";
  }

  if (
    text.includes("should i take this") ||
    text.includes("should i choose this") ||
    text.includes("recommend this unit")
  ) {
    return "recommend_unit_decision";
  }

  if (
    text.includes("compare unit") ||
    text.includes("compare room") ||
    text.includes("compare these units")
  ) {
    return "compare_units";
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
    if (
      (text.includes("corridor") && text.includes("density")) ||
      text.includes("highest complaint density") ||
      text.includes("which corridor is risky") ||
      text.includes("corridor risk")
    ) {
      return "admin_density";
    }
  }

  return "unsupported";
}

function isFollowUpQuery(query) {
  return /\b(it|this|that)\b/i.test(String(query || "").trim());
}

function resolveFollowUpIntent(query, memory) {
  const text = String(query || "").toLowerCase().trim();
  if (/risk|safe|trust/i.test(text) && (memory?.lastUnitId || memory?.lastViewedUnitId)) {
    return {
      intent: "explain_unit_trust",
      unitId: memory?.lastUnitId || memory?.lastViewedUnitId || null,
    };
  }

  if (/should|take|choose/i.test(text) && (memory?.lastUnitId || memory?.lastViewedUnitId)) {
    return {
      intent: "recommend_unit_decision",
      unitId: memory?.lastUnitId || memory?.lastViewedUnitId || null,
    };
  }

  return null;
}

function inferFollowUpIntent(role, message, memory, resolvedContext) {
  const text = String(message || "").toLowerCase().trim();
  const hasUnitContext = Boolean(resolvedContext?.unitId || memory?.lastUnitId || memory?.lastViewedUnitId);
  const hasCorridorContext = Boolean(resolvedContext?.corridorId || memory?.lastCorridorId);

  const semanticFollowUp = isFollowUpQuery(text) ? resolveFollowUpIntent(text, memory) : null;
  if (semanticFollowUp?.intent) {
    return semanticFollowUp.intent;
  }

  const wantsRiskExplanation =
    /why is (it|this|that|my unit|my housing) risky/.test(text) ||
    /why is (it|this|that) unsafe/.test(text) ||
    /what is driving (the )?risk/.test(text) ||
    /explain (the )?risk/.test(text) ||
    /why is that a problem/.test(text);

  if (wantsRiskExplanation) {
    if (hasUnitContext) return "explain_unit_trust";
    if (role === "admin" && hasCorridorContext) return "admin_density";
    if (hasCorridorContext) return "corridor_behavioral_insight";
  }

  if (/is it safe|is this safe|is that safe/.test(text) && hasUnitContext) {
    return "explain_unit_trust";
  }

  if (/should i take this|should i choose this|should i take it|should i choose it/.test(text) && hasUnitContext) {
    return "recommend_unit_decision";
  }

  if (/see risk forecast|show risk forecast|forecast risk|what is the risk/.test(text) && hasUnitContext) {
    return "predict_unit_risk";
  }

  if (
    /see trust breakdown|show trust breakdown|why is trust low|why did trust drop|explain trust/.test(text) &&
    hasUnitContext
  ) {
    return "explain_unit_trust";
  }

  if (/view complaints|show complaints|complaint history|show complaint summary/.test(text) && role === "student") {
    return "student_complaint_summary";
  }

  if (/how is it doing|how is that doing|what about this unit|what about that unit/.test(text) && hasUnitContext) {
    return "explain_unit_overview";
  }

  return null;
}

function buildSuggestions(intent, role, result, resolvedContext) {
  const unitId = resolvedContext?.unitId || result?.data?.unitId || result?.data?.trust?.unitId || null;
  const complaintCount =
    Number(result?.data?.complaintCount) ||
    Number(result?.data?.healthReport?.complaintsLast30Days) ||
    Number(resolvedContext?.activeComplaintsCount) ||
    0;

  if (intent === "student_search") {
    return ["Explain this unit", "Why is it risky?", "Should I take this?"];
  }
  if (intent === "student_complaint") {
    if (result?.requiresConfirmation) return ["Confirm complaint", "Change severity", "Add duration"];
    return ["View complaints", "See trust breakdown", "How is my unit doing?"];
  }
  if (intent === "student_unit_health" || intent === "predict_unit_risk") {
    return [
      complaintCount > 0 ? "View complaints" : "Report an issue",
      "See trust breakdown",
      "Why is it risky?",
    ];
  }
  if (intent === "recommend_unit_decision") {
    return ["See trust breakdown", "See risk forecast", "Report an issue"];
  }
  if (intent === "compare_units") {
    return ["Should I take this?", "See trust breakdown", "See risk forecast"];
  }
  if (intent === "system_health_summary") {
    if (role === "student") return ["Why is it risky?", "View complaints", "Report an issue"];
    if (role === "landlord") return ["What should I fix first?", "Which units are at risk?", "Show recurring issues"];
    if (role === "admin") return ["Which corridor is risky?", "Units needing attention", "How is the housing system doing right now"];
  }
  if (intent === "explain_unit_trust" || intent === "explain_unit_overview") {
    return ["See risk forecast", "View complaints", role === "student" ? "Report an issue" : "Which units are at risk?"];
  }
  if (intent === "landlord_remediation_advisor") {
    return ["Which units are at risk?", "Show recurring issues", "Any operational problems?"];
  }
  if (intent === "landlord_risk" || intent === "landlord_recurring") {
    return ["What should I fix first?", "Any operational problems?", "Explain this unit"];
  }
  if (intent === "admin_density" || intent === "corridor_behavioral_insight" || intent === "operations_advisor") {
    return ["Units needing attention", "Which corridor is risky?", "Explain this unit"];
  }

  if (role === "student") return ["Find safe rooms under ₹8000", "Why is my unit risky?", "Report an issue"];
  if (role === "landlord") return ["What should I fix first?", "Which units are at risk?", "Show recurring issues"];
  if (role === "admin") return ["Which corridor is risky?", "Units needing attention", "Any operational problems?"];
  return [];
}

function buildResponseSummary(intent, result, resolvedContext) {
  const trustScore =
    result?.data?.trustScore ??
    result?.data?.trust?.trustScore ??
    result?.data?.healthReport?.trustScore ??
    resolvedContext?.trustScore ??
    null;
  const riskLevel =
    result?.data?.riskLevel ??
    result?.data?.riskForecast?.riskLevel ??
    result?.data?.riskSignal?.riskLevel ??
    result?.riskSignal?.riskLevel ??
    result?.riskForecast?.riskLevel ??
    resolvedContext?.lastKnownRiskLevel ??
    null;
  const complaintCount =
    result?.data?.complaintCount ??
    result?.data?.healthReport?.complaintsLast30Days ??
    result?.data?.complaintsLast30Days ??
    resolvedContext?.activeComplaintsCount ??
    null;

  return {
    unitId: result?.data?.unitId ?? result?.data?.trust?.unitId ?? resolvedContext?.unitId ?? null,
    corridorId: result?.data?.corridorId ?? resolvedContext?.corridorId ?? null,
    trustScore,
    riskLevel,
    complaintCount,
    intent,
  };
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
    const summary = {
      unitId: insightContext.unit,
      corridorId: insightContext.corridorMetrics?.corridorId || null,
      trustScore: insightContext.trustScore ?? null,
      riskLevel:
        insightContext.trustScore !== null && insightContext.trustScore !== undefined
          ? Number(insightContext.trustScore) < 50
            ? "HIGH"
            : Number(insightContext.trustScore) < 70
              ? "MEDIUM"
              : "LOW"
          : insightContext.corridorMetrics?.complaintDensityIncreasing
            ? "MEDIUM"
            : "LOW",
      complaintCount: insightContext.unresolvedComplaints ?? 0,
    };

    const assistant = normalizeResponse(
      req.user.role === "student"
        ? summary.complaintCount > 0
          ? `You have ${summary.complaintCount} unresolved complaint${summary.complaintCount === 1 ? "" : "s"} linked to your unit.`
          : "Your housing profile is stable right now. I can explain trust or help report a new issue."
        : req.user.role === "landlord"
          ? summary.unitId
            ? `Unit ${summary.unitId} is the best place to review first based on current complaint pressure.`
            : "Your portfolio looks stable right now. I can still check risk and recurring issues."
          : summary.corridorId
            ? `Complaint density is rising around corridor ${summary.corridorId}.`
            : "I can highlight the corridors and units that need governance attention."
    );

    return res.json({
      role: req.user.role,
      unit: insightContext.unit,
      trustScore: insightContext.trustScore,
      insights,
      assistant,
      summary,
      suggestions: buildSuggestions("insights", req.user.role, { data: summary }, summary),
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
    const { message, confirm, action, intent: providedIntent, unitId, corridorId } = req.body || {};
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
    const normalizedText = preprocessDawnText(message);

    const shouldClearContext = /^\/?(clear|reset)\s+(memory|context)$/i.test(message.trim());
    if (shouldClearContext) {
      clearContext(userId);
      return res.json({
        intent: "context_reset",
        assistant: normalizeResponse("Context cleared. We can start fresh."),
        suggestions: buildSuggestions("context_reset", role, {}, {}),
      });
    }

    const baseContext = createDawnContext(req, token, memory);
    baseContext.hintedUnitId = unitId;
    baseContext.hintedCorridorId = corridorId;
    const resolvedContext = await buildResolvedContext(req, baseContext);

    let inferredIntent = inferIntent(role, normalizedText);
    if (memory?.pendingFollowUp?.intent === "student_complaint") {
      inferredIntent = "student_complaint";
    }
    if (inferredIntent === "unsupported") {
      inferredIntent = inferFollowUpIntent(role, normalizedText, memory, resolvedContext) || inferredIntent;
    }
    if (inferredIntent === "unsupported" && memory?.lastIntent) {
      inferredIntent = memory.lastIntent;
    }

    const intent = typeof providedIntent === "string" && providedIntent.trim() ? providedIntent.trim() : inferredIntent;
    const handler = intentMap[intent];

    if (!handler) {
      return res.json({
        intent: "unsupported",
        assistant: normalizeResponse("I couldn’t fully resolve that. Try specifying a unit or corridor."),
        suggestions: buildSuggestions("unsupported", role, {}, resolvedContext),
        summary: buildResponseSummary("unsupported", {}, resolvedContext),
      });
    }

    const context = {
      ...baseContext,
      message: message.trim(),
      text: normalizedText,
      confirm: Boolean(confirm),
      action: action && typeof action === "object" ? action : null,
      intent,
      resolvedContext,
    };

    const result = await handler({ req, context });
    const normalizedResult = {
      ...(result || {}),
      ...(typeof result?.assistant === "string" ? { assistant: normalizeResponse(result.assistant) } : {}),
      ...(typeof result?.message === "string" ? { message: normalizeResponse(result.message) } : {}),
    };
    const summary = buildResponseSummary(intent, normalizedResult || {}, resolvedContext);
    const suggestions = buildSuggestions(intent, role, normalizedResult || {}, resolvedContext);

    updateContext(userId, {
      lastIntent: intent,
      ...(summary.unitId ? { lastUnitId: summary.unitId, lastViewedUnitId: summary.unitId } : {}),
      ...(summary.corridorId ? { lastCorridorId: summary.corridorId } : {}),
      ...(summary.trustScore !== null && summary.trustScore !== undefined ? { lastKnownTrustScore: summary.trustScore } : {}),
      ...(summary.complaintCount !== null && summary.complaintCount !== undefined ? { lastKnownComplaintCount: summary.complaintCount } : {}),
      ...(summary.riskLevel ? { lastKnownRiskLevel: summary.riskLevel } : {}),
      currentUnitId: resolvedContext.unitId,
      currentCorridorId: resolvedContext.corridorId,
      currentTrustScore: resolvedContext.trustScore,
      currentActiveComplaints: resolvedContext.activeComplaintsCount,
    });

    const assistant = normalizeResponse(formatDawnResponse(intent, normalizedResult || {}));
    return res.json({
      intent,
      ...(normalizedResult || {}),
      assistant,
      suggestions,
      summary,
      context: {
        role,
        unitId: resolvedContext.unitId,
        corridorId: resolvedContext.corridorId,
        trustScore: resolvedContext.trustScore,
        activeComplaintsCount: resolvedContext.activeComplaintsCount,
      },
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
