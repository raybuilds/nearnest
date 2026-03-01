const { ensureRole } = require("./utils");

module.exports = async function studentComplaintSummary({ req, context }) {
  ensureRole(req, ["student"]);

  const { callApi } = context;
  const profile = await callApi("/profile");

  const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  if (!unitId) {
    return {
      assistant: "No active unit is linked to your profile yet.",
    };
  }

  const [unitComplaintSummary, unitDetails] = await Promise.all([
    callApi(`/unit/${unitId}/complaints`),
    callApi(`/student/unit/${unitId}/details`).catch(() => null),
  ]);

  const complaintHealth = profile?.currentAccommodation?.complaintHealth || {};
  const trust = profile?.currentAccommodation?.trust || {};
  const summary = unitComplaintSummary?.summary || {};
  const trustSignals = unitDetails?.trustSignals || {};

  return {
    assistant: `Unit #${unitId} health summary for the last 30 days.`,
    data: {
      unitId,
      complaints30d: summary.complaintsLast30Days ?? complaintHealth.totalComplaints30d ?? 0,
      openComplaints: summary.activeComplaints ?? complaintHealth.openComplaints30d ?? 0,
      avgResolutionHours30d: summary.avgResolutionHours30d ?? complaintHealth.avgResolutionHours30d ?? null,
      slaBreaches30d: summary.slaBreaches30d ?? complaintHealth.slaBreaches30d ?? null,
      trustScore: summary.trustScore ?? trustSignals.trustScore ?? trust.trustScore ?? null,
      trustBand: summary.trustBand ?? trustSignals.trustBand ?? trust.trustBand ?? null,
    },
  };
};
