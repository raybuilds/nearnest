const { callApi: callApiWithToken, createHttpError } = require("../dawnIntents/utils");

function resolveCallApi(context) {
  if (typeof context?.callApi === "function") {
    return (path, options) => context.callApi(path, options);
  }

  if (context?.token) {
    return (path, options) => callApiWithToken(path, context.token, options);
  }

  throw createHttpError(500, "Unit health service requires callApi access");
}

function getHealthTrustBand(trustScore) {
  const score = Number(trustScore || 0);
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  return "risk";
}

function buildTrend({ complaintsLast30Days, trendDirection }) {
  if (complaintsLast30Days >= 3) return "declining";
  if (complaintsLast30Days === 0) return "stable";
  if (trendDirection === "down") return "improving";
  return "stable";
}

function buildRiskSignals({ trustBand, complaintsLast30Days, slaBreaches30Days, unresolvedComplaints }) {
  const signals = [];

  if (trustBand === "risk") {
    signals.push("Trust score is in the risk band");
  }
  if (complaintsLast30Days >= 2) {
    signals.push("Recurring complaints detected");
  }
  if (slaBreaches30Days >= 2) {
    signals.push("Response delays detected");
  }
  if (unresolvedComplaints >= 3) {
    signals.push("Multiple unresolved complaints remain open");
  }

  return signals;
}

function buildSummary({ trustScore, trustBand, trend, complaintsLast30Days, slaBreaches30Days, riskSignals }) {
  if (trustBand === "risk") {
    return `Your housing may be at risk. Trust score is ${trustScore} with ${complaintsLast30Days} recent complaints and ${slaBreaches30Days} response delays.`;
  }

  if (riskSignals.length > 0 || trend === "declining") {
    return `Your housing is under watch with a trust score of ${trustScore}. Recent complaints or response delays suggest closer monitoring is needed.`;
  }

  return `Your housing is currently ${trend} with a trust score of ${trustScore}. Recent complaints are low and response performance is within acceptable limits.`;
}

async function getUnitHealthReport(context) {
  const callApi = resolveCallApi(context);
  const { unitId, corridorId } = context || {};

  if (!unitId) {
    throw createHttpError(400, "Unit health report requires unitId");
  }

  const [profile, complaintPayload, visibleUnits, explainPayload] = await Promise.all([
    callApi("/profile"),
    callApi(`/unit/${unitId}/complaints`),
    corridorId ? callApi(`/units/${corridorId}`).catch(() => []) : Promise.resolve([]),
    callApi(`/unit/${unitId}/explain`).catch(() => null),
  ]);

  const currentAccommodation = profile?.currentAccommodation || {};
  const complaintHealth = currentAccommodation?.complaintHealth || {};
  const complaintSummary = complaintPayload?.summary || {};
  const visibleUnit = Array.isArray(visibleUnits)
    ? visibleUnits.find((item) => Number(item?.id) === Number(unitId))
    : null;

  const trustScore = Number(
    complaintSummary.trustScore ??
      explainPayload?.trustScore ??
      currentAccommodation?.trust?.trustScore ??
      visibleUnit?.trustScore ??
      0
  );
  const trustBand =
    complaintSummary.trustBand ??
    explainPayload?.trustBand ??
    currentAccommodation?.trust?.trustBand ??
    getHealthTrustBand(trustScore);
  const auditRequired = Boolean(
    complaintSummary.auditRequired ??
      explainPayload?.auditRequired ??
      currentAccommodation?.trust?.auditRequired ??
      visibleUnit?.auditRequired ??
      false
  );
  const complaintsLast30Days = Number(
    complaintSummary.complaintsLast30Days ??
      complaintHealth.totalComplaints30d ??
      0
  );
  const unresolvedComplaints = Number(
    complaintSummary.activeComplaints ??
      complaintHealth.openComplaints30d ??
      0
  );
  const slaBreaches30Days = Number(
    complaintSummary.slaBreaches30d ??
      complaintHealth.slaBreaches30d ??
      0
  );
  const trend = buildTrend({
    complaintsLast30Days,
    trendDirection: complaintHealth?.trend?.direction,
  });
  const riskSignals = buildRiskSignals({
    trustBand,
    complaintsLast30Days,
    slaBreaches30Days,
    unresolvedComplaints,
  });
  if (auditRequired && !riskSignals.includes("Unit is currently flagged for audit")) {
    riskSignals.unshift("Unit is currently flagged for audit");
  }

  return {
    trustScore,
    trustBand,
    auditRequired,
    complaintsLast30Days,
    unresolvedComplaints,
    slaBreaches30Days,
    trend,
    riskSignals,
    summary: buildSummary({
      trustScore,
      trustBand,
      trend,
      complaintsLast30Days,
      slaBreaches30Days,
      riskSignals,
    }),
  };
}

module.exports = {
  getUnitHealthReport,
};
