const { callApi: callApiWithToken, createHttpError } = require("../dawnIntents/utils");

function resolveCallApi(options) {
  if (typeof options?.callApi === "function") {
    return (path, requestOptions) => options.callApi(path, requestOptions);
  }

  if (options?.token) {
    return (path, requestOptions) => callApiWithToken(path, options.token, requestOptions);
  }

  throw createHttpError(500, "Corridor insight service requires callApi access");
}

function sortIncidentFrequency(incidentFrequency) {
  return Object.fromEntries(
    Object.entries(incidentFrequency || {}).sort((a, b) => {
      if (Number(b[1]) !== Number(a[1])) return Number(b[1]) - Number(a[1]);
      return String(a[0]).localeCompare(String(b[0]));
    })
  );
}

async function getCorridorInsights(corridorId, options = {}) {
  const resolvedCorridorId = Number(corridorId);
  if (Number.isNaN(resolvedCorridorId)) {
    throw createHttpError(400, "corridorId must be a number");
  }

  const callApi = resolveCallApi(options);
  const overview = await callApi(`/corridor/${resolvedCorridorId}/overview`);
  const behavioral = overview?.behavioralInsights || {};

  const incidentFrequency = sortIncidentFrequency(behavioral.incidentFrequency || {});
  const unitsNearSuspension = Number(behavioral.unitsNearSuspension || 0);
  const slaBreaches = Number(behavioral.slaBreaches || 0);
  const riskLevel = String(behavioral.riskLevel || overview?.riskSummary?.riskLevel || "LOW");
  const complaintDensity = Number(behavioral.complaintDensity || overview?.riskSummary?.complaintDensity || 0);
  const severeIncidents = Number(behavioral.severeIncidents || overview?.riskSummary?.severeIncidents || 0);
  const unresolvedComplaints = Number(behavioral.unresolvedComplaints || overview?.riskSummary?.unresolvedComplaints || 0);

  const insights = [];
  const trend14d = overview?.trend14d || overview?.riskSummary?.trend14d || {
    current14d: 0,
    previous14d: 0,
  };
  if (Number(incidentFrequency.water || 0) >= 3) {
    insights.push("Recurring water complaints detected in this corridor.");
  }
  if (unitsNearSuspension >= 2) {
    insights.push(`${unitsNearSuspension} units near suspension threshold.`);
  }
  if (slaBreaches >= 2) {
    insights.push("Response delays increasing across corridor.");
  }
  if (riskLevel === "HIGH") {
    insights.push("This corridor is currently in a high-risk zone.");
  } else if (riskLevel === "MEDIUM") {
    insights.push("This corridor is showing medium-risk behavior and should be monitored.");
  }

  if (insights.length === 0) {
    insights.push("No major corridor-wide behavioral risks detected right now.");
  }

  return {
    corridorId: resolvedCorridorId,
    riskLevel,
    complaintDensity,
    severeIncidents,
    incidentFrequency,
    unitsNearSuspension,
    slaBreaches,
    unresolvedComplaints,
    trend14d,
    trustScores: Array.isArray(behavioral.trustScores) ? behavioral.trustScores : [],
    insights,
  };
}

module.exports = {
  getCorridorInsights,
};
