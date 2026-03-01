const { HIGH_DENSITY_THRESHOLD, createHttpError, ensureRole, parseRequestedLandlordId } = require("./utils");

module.exports = async function landlordRiskSummary({ req, context }) {
  ensureRole(req, ["landlord"]);

  const { callApi } = context;
  const profile = await callApi("/profile");
  const ownLandlordId = profile?.identity?.landlordId || null;
  const requestedLandlordId = parseRequestedLandlordId(context.text);
  if (requestedLandlordId !== null && ownLandlordId !== null && requestedLandlordId !== ownLandlordId) {
    throw createHttpError(403, "Dawn can only access your own landlord data");
  }

  const units = await callApi("/landlord/units");
  const list = Array.isArray(units) ? units : [];

  const risky = list
    .map((unit) => {
      const reasons = [];
      if (Number(unit.trustScore) < 50) reasons.push("trust score below 50");
      if (unit.auditRequired) reasons.push("audit required");
      if (Number(unit.complaintsLast30Days || 0) >= HIGH_DENSITY_THRESHOLD) {
        reasons.push(`high complaint density (${unit.complaintsLast30Days} in 30d)`);
      }

      return {
        unitId: unit.id,
        trustScore: unit.trustScore,
        trustBand: unit.trustBand,
        auditRequired: unit.auditRequired,
        complaintsLast30Days: unit.complaintsLast30Days,
        slaLateCount: unit.slaLateCount,
        reasons,
        riskScore: reasons.length,
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.riskScore - a.riskScore || Number(a.trustScore) - Number(b.trustScore));

  return {
    assistant: `Found ${risky.length} units with risk indicators.`,
    data: risky,
  };
};
