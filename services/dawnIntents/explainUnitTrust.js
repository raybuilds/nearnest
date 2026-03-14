const { explainTrust } = require("../intelligence/trustExplanationService");
const { createHttpError, ensureRole, parseRequestedUnitId } = require("./utils");

async function resolveUnitId(req, context) {
  const explicitUnitId = parseRequestedUnitId(context.message) ?? parseRequestedUnitId(context.text);
  if (explicitUnitId) {
    return explicitUnitId;
  }

  if (context.action?.payload?.unitId) {
    return Number(context.action.payload.unitId);
  }

  if (context.memory?.lastUnitId) {
    return Number(context.memory.lastUnitId);
  }

  if (req.user.role === "student") {
    const profile = await context.callApi("/profile");
    return profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  }

  return null;
}

module.exports = async function explainUnitTrust({ req, context }) {
  ensureRole(req, ["student", "landlord", "admin"]);

  const unitId = await resolveUnitId(req, context);
  if (!unitId) {
    throw createHttpError(400, "Please specify which unit trust score to explain.");
  }

  const explanation = await explainTrust(unitId, {
    callApi: context.callApi,
  });

  context.updateMemory({
    lastIntent: "explain_unit_trust",
    lastUnitId: unitId,
  });

  return {
    assistant: `Trust score explanation prepared for Unit #${unitId}.`,
    data: explanation,
  };
};
