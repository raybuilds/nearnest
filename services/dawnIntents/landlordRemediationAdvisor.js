const { getRemediationPriorities } = require("../intelligence/dawnRemediationService");
const { createHttpError, ensureRole, parseRequestedLandlordId } = require("./utils");

module.exports = async function landlordRemediationAdvisor({ req, context }) {
  ensureRole(req, ["landlord"]);

  const profile = await context.callApi("/profile");
  const landlordId = profile?.identity?.landlordId || null;
  const requestedLandlordId = parseRequestedLandlordId(context.text);

  if (requestedLandlordId !== null && landlordId !== null && requestedLandlordId !== landlordId) {
    throw createHttpError(403, "Dawn can only access your own landlord data");
  }

  if (!landlordId) {
    return {
      assistant: "I could not determine your landlord profile.",
    };
  }

  const report = await getRemediationPriorities(landlordId, {
    callApi: context.callApi,
  });

  context.updateMemory({
    lastIntent: "landlord_remediation_advisor",
    lastUnitId: report.priorities[0]?.unitId || null,
  });

  return {
    message: "Here are the highest priority issues to address:",
    assistant: `Prepared remediation priorities for your top ${report.priorities.length} units.`,
    priorities: report.priorities.map((item) => ({
      unitId: item.unitId,
      issue: item.issue,
      recommendation: item.recommendation,
    })),
    data: report,
  };
};
