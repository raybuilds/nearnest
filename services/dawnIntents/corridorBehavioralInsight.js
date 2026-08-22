const { getCorridorInsights } = require("../intelligence/dawnCorridorInsightService");
const { ensureRole } = require("./utils");

function resolveCorridorId(profile) {
  return (
    profile?.identity?.corridor?.id ||
    profile?.occupancy?.currentUnit?.corridor?.id ||
    profile?.currentAccommodation?.identity?.corridor?.id ||
    profile?.identity?.corridorsActiveIn?.[0]?.id ||
    profile?.governanceScope?.assignedCorridors?.[0]?.id ||
    null
  );
}

module.exports = async function corridorBehavioralInsight({ req, context }) {
  ensureRole(req, ["student", "landlord", "admin"]);

  const profile = await context.callApi("/profile");
  const corridorId = resolveCorridorId(profile);

  if (!corridorId) {
    return {
      assistant: "I could not determine which corridor to analyze from your profile.",
    };
  }

  const report = await getCorridorInsights(corridorId, {
    callApi: context.callApi,
  });

  context.updateMemory({
    lastIntent: "corridor_behavioral_insight",
    lastCorridorId: corridorId,
  });

  return {
    message: "Here are the current corridor insights:",
    assistant: `Corridor #${corridorId} behavioral insights prepared.`,
    insights: report.insights,
    data: report,
  };
};
