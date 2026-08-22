function normalizeResponse(text) {
  const value = String(text || "").trim();
  if (!value) {
    return "I couldn’t fully resolve that. Try specifying a unit or corridor.";
  }

  return value
    .replace(/Consider/gi, "You should")
    .replace(/may improve/gi, "will improve")
    .replace(/^Done\.?$/gi, "Here’s what I found based on your request:")
    .replace(/^Dawn completed the request\.?$/gi, "Here’s what I found based on your request:");
}

function formatStudentSearch(result) {
  const recommendations = Array.isArray(result?.data?.recommendations) ? result.data.recommendations : [];
  if (recommendations.length === 0) {
    return "I could not find matching rooms right now. Try adjusting your filters.";
  }

  const top = recommendations[0];
  return [
    `I found ${result?.data?.totalMatched ?? recommendations.length} rooms matching your request.`,
    `Top recommendation: Unit ${top.id} - Rs ${top.rent} - Trust Score ${top.trustScore} - ${top.distanceKm} km.`,
    "I ranked results by trust, availability, distance, and price.",
  ].join(" ");
}

function formatStudentComplaint(result) {
  if (result?.requiresConfirmation && result?.data?.draft) {
    const draft = result.data.draft;
    return `I prepared a complaint draft (severity ${draft.severity}, ${draft.incidentType}). Confirm and I will submit it.`;
  }
  if (result?.data?.complaintId) {
    return `Complaint #${result.data.complaintId} submitted successfully.`;
  }
  return result?.assistant || "I could not prepare a complaint action right now.";
}

function formatLandlordRecurring(result) {
  const topIssue = result?.data?.topIssues?.[0];
  if (!topIssue) return "No recurring complaint pattern detected in the last 30 days.";
  return `Top recurring issue is ${topIssue.incidentType} with ${topIssue.complaintCount} complaints in 30 days.`;
}

function formatAdminDensity(result) {
  const top = result?.data?.corridors?.[0];
  if (!top) return "No corridor analytics available for the last 30 days.";
  return `Corridor ${top.corridorId} has the highest complaint density (${top.complaintDensity}) and ${top.unitsNearSuspension} units near suspension.`;
}

function formatTrustExplanation(result) {
  const trustScore = result?.data?.trustScore;
  const drivers = Array.isArray(result?.data?.drivers) ? result.data.drivers : [];
  if (trustScore === undefined || trustScore === null) {
    return "I could not explain that unit trust score right now.";
  }
  if (drivers.length === 0) {
    return `Unit trust score is ${trustScore}. No major drivers were available to explain the change.`;
  }
  return `Unit trust score is ${trustScore}. Main drivers: ${drivers.join("; ")}.`;
}

function formatUnitOverview(result) {
  const trust = result?.data?.trust || {};
  const health = result?.data?.healthReport || {};
  const risk = result?.data?.riskForecast || {};
  const trustScore = trust?.trustScore ?? health?.trustScore ?? "N/A";
  const complaintCount = health?.complaintsLast30Days ?? 0;
  const riskLevel = risk?.riskLevel || "STABLE";

  return `Unit ${result?.data?.unitId || ""} is currently at trust score ${trustScore} with ${complaintCount} recent complaints and risk level ${riskLevel}. I combined trust drivers, complaint health, and forecast signals so you can decide the next action quickly.`.trim();
}

function formatStudentUnitHealth(result) {
  const report = result?.data?.healthReport || result?.data;
  if (!report) {
    return result?.message || "I could not prepare the housing health report right now.";
  }

  const trustScore = report.trustScore ?? result?.data?.trustScore ?? "N/A";
  const trend = report.complaintTrend ?? result?.data?.trend ?? "unknown";
  const responsePerformance = report.responsePerformance ?? "unknown";
  return `Here is the health report for your housing: trust score ${trustScore}, complaint trend ${trend}, response performance ${responsePerformance}.`;
}

function formatPredictUnitRisk(result) {
  const forecast =
    result?.data?.riskSignal ||
    result?.riskSignal ||
    result?.data?.riskForecast ||
    result?.riskForecast ||
    result?.data;
  if (!forecast) {
    return result?.message || "I could not prepare a unit risk forecast right now.";
  }

  const riskSignal = forecast.riskSignal ?? forecast.riskLevel ?? "unknown";
  const indicators = Array.isArray(forecast.indicators) ? forecast.indicators : [];
  const recommendation = forecast.recommendation || "Review this unit and act on the leading indicators.";
  const indicatorText = indicators.length > 0 ? indicators.join("; ") : "No major early warning indicators right now";
  return `Risk Signal: ${riskSignal}. Indicators: ${indicatorText}. Recommendation: ${recommendation}`;
}

function formatCorridorBehavioralInsight(result) {
  const insights = Array.isArray(result?.insights)
    ? result.insights
    : Array.isArray(result?.data?.insights)
      ? result.data.insights
      : [];

  if (insights.length === 0) {
    return result?.message || "I could not prepare corridor behavioral insights right now.";
  }

  return `Here are the current corridor insights: ${insights.join(" ")}`;
}

function formatLandlordRemediationAdvisor(result) {
  const priorities = Array.isArray(result?.priorities)
    ? result.priorities
    : Array.isArray(result?.data?.priorities)
      ? result.data.priorities
      : [];

  if (priorities.length === 0) {
    return result?.message || "I could not prepare remediation priorities right now.";
  }

  const top = priorities[0];
  return `Here are the highest priority issues to address: Unit ${top.unitId} should be reviewed first for ${String(top.issue || "").toLowerCase()}.`;
}

function formatUnitDecision(result) {
  const data = result?.data || {};
  const verdict = data.verdict || "I couldn’t fully resolve that. Try specifying a unit or corridor.";
  const recommendation = data.recommendation || "Review this unit before making a decision.";
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  return [verdict, `Next step: ${recommendation}`, reasons.length > 0 ? `Why: ${reasons.join("; ")}` : ""]
    .filter(Boolean)
    .join(" ");
}

function formatCompareUnits(result) {
  const units = Array.isArray(result?.data?.units) ? result.data.units : [];
  if (units.length < 2) {
    return result?.message || "I couldn’t fully resolve that. Try specifying a unit or corridor.";
  }

  const winner = result?.data?.recommendation;
  const summary = units
    .map((unit) => `Unit ${unit.unitId}: trust ${unit.trustScore}, ${unit.complaints} complaints, risk ${unit.riskLevel}`)
    .join(" | ");
  return `${summary}. Recommendation: choose Unit ${winner}.`;
}

function formatSystemHealthSummary(result) {
  const data = result?.data || {};
  if (data.role === "student") {
    return `Your current housing status: trust ${data.trustScore}, complaints ${data.complaintCount}, risk ${data.riskLevel}.`;
  }
  if (data.role === "landlord") {
    const distribution = data.riskDistribution || {};
    return `Portfolio status: ${data.totalUnits} units, ${distribution.high || 0} high-risk, ${distribution.medium || 0} medium-risk, and ${distribution.low || 0} lower-risk units.`;
  }
  if (data.role === "admin") {
    const riskyCorridors = Array.isArray(data.riskyCorridors) ? data.riskyCorridors : [];
    return `System status: ${riskyCorridors.length} corridor(s) need attention. Top issues are ${Array.isArray(data.topIssues) ? data.topIssues.map((item) => item.incidentType).join(", ") : "not significant"}.`;
  }
  return result?.message || "I couldn’t fully resolve that. Try specifying a unit or corridor.";
}

function formatOperationsAdvisor(result) {
  const alerts = Array.isArray(result?.alerts)
    ? result.alerts
    : Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.data?.alerts)
        ? result.data.alerts
        : [];

  if (alerts.length === 0) {
    return result?.message || "I could not prepare operational recommendations right now.";
  }

  const lead = alerts[0] || {};
  const units = Array.isArray(lead.units) ? lead.units : [];
  if (units.length > 0 && units[0]?.unitId) {
    const top = units[0];
    const indicators = Array.isArray(top.indicators) ? top.indicators : [];
    return `Operational Alert: ${lead.title || "Operational review"}. Unit ${top.unitId} should be reviewed first. Indicators: ${indicators.join("; ") || "See advisory details"}. Recommendation: ${top.recommendation || lead.message || "Review the current operational signals now."}`;
  }

  return `Operational Alert: ${lead.title || "Operational review"}. ${lead.message || "Review the current operational signals now."}`;
}

function formatDawnResponse(intent, result) {
  if (intent === "student_search") return formatStudentSearch(result);
  if (intent === "student_complaint") return formatStudentComplaint(result);
  if (intent === "student_unit_health") return formatStudentUnitHealth(result);
  if (intent === "predict_unit_risk") return formatPredictUnitRisk(result);
  if (intent === "recommend_unit_decision") return formatUnitDecision(result);
  if (intent === "compare_units") return formatCompareUnits(result);
  if (intent === "system_health_summary") return formatSystemHealthSummary(result);
  if (intent === "operations_advisor") return formatOperationsAdvisor(result);
  if (intent === "corridor_behavioral_insight") return formatCorridorBehavioralInsight(result);
  if (intent === "landlord_remediation_advisor") return formatLandlordRemediationAdvisor(result);
  if (intent === "landlord_recurring") return formatLandlordRecurring(result);
  if (intent === "admin_density") return formatAdminDensity(result);
  if (intent === "explain_unit_trust") return formatTrustExplanation(result);
  if (intent === "explain_unit_overview") return formatUnitOverview(result);
  return result?.assistant || "I couldn’t fully resolve that. Try specifying a unit or corridor.";
}

module.exports = {
  formatDawnResponse,
  normalizeResponse,
};

