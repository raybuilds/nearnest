const { callApi: callApiWithToken, createHttpError } = require("../dawnIntents/utils");

function resolveCallApi(options) {
  if (typeof options?.callApi === "function") {
    return (path, requestOptions) => options.callApi(path, requestOptions);
  }

  if (options?.token) {
    return (path, requestOptions) => callApiWithToken(path, options.token, requestOptions);
  }

  throw createHttpError(500, "Remediation service requires callApi access");
}

function buildRecommendations(unit) {
  const recommendations = [];

  if (Number(unit.complaintsLast30Days || 0) >= 2) {
    recommendations.push("Recurring complaints detected. Inspect infrastructure.");
  }
  if (Number(unit.slaBreaches || 0) >= 2) {
    recommendations.push("Response delays detected. Improve complaint response time.");
  }
  if (Number(unit.unresolvedComplaints || 0) >= 1) {
    recommendations.push("Resolve pending complaints to stabilize trust score.");
  }

  return recommendations;
}

function buildIssueLabel(unit) {
  if (Number(unit.unresolvedComplaints || 0) >= 1) {
    return "Pending complaints affecting trust stability";
  }
  if (Number(unit.slaBreaches || 0) >= 2) {
    return "Response delays affecting unit reliability";
  }
  if (Number(unit.complaintsLast30Days || 0) >= 2) {
    return "Recurring complaints increasing operational risk";
  }
  if (Number(unit.trustScore || 0) < 60) {
    return "Trust score below watch threshold";
  }
  return "Operational follow-up recommended";
}

async function getRemediationPriorities(landlordId, options = {}) {
  const resolvedLandlordId = Number(landlordId);
  if (Number.isNaN(resolvedLandlordId)) {
    throw createHttpError(400, "landlordId must be a number");
  }

  const callApi = resolveCallApi(options);
  const units = await callApi("/landlord/units");
  const list = Array.isArray(units) ? units : [];

  const priorities = list
    .map((unit) => {
      const trustScore = Number(unit.trustScore || 0);
      const complaintsLast30Days = Number(unit.complaintsLast30Days || 0);
      const slaBreaches = Number(unit.slaLateCount || unit.slaBreaches || 0);
      const unresolvedComplaints = Number(unit.activeComplaints || unit.unresolvedComplaints || 0);
      const riskScore =
        complaintsLast30Days * 2 +
        slaBreaches * 3 +
        unresolvedComplaints * 4 +
        (trustScore < 60 ? 60 - trustScore : 0);

      const recommendations = buildRecommendations({
        complaintsLast30Days,
        slaBreaches,
        unresolvedComplaints,
      });

      return {
        unitId: unit.id,
        trustScore,
        complaintsLast30Days,
        slaBreaches,
        unresolvedComplaints,
        riskScore,
        issue: buildIssueLabel({
          trustScore,
          complaintsLast30Days,
          slaBreaches,
          unresolvedComplaints,
        }),
        recommendation: recommendations[0] || "Review this unit for early operational issues.",
        recommendations,
      };
    })
    .filter((unit) => unit.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore || a.trustScore - b.trustScore || a.unitId - b.unitId)
    .slice(0, 3);

  return {
    landlordId: resolvedLandlordId,
    priorities,
  };
}

module.exports = {
  getRemediationPriorities,
};
