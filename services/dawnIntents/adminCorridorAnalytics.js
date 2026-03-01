const { ensureRole, inLastDays } = require("./utils");

const CORRIDOR_DENSITY_ALERT_THRESHOLD = 5;

module.exports = async function adminCorridorAnalytics({ req, context }) {
  ensureRole(req, ["admin"]);

  const { callApi } = context;
  const complaintPayload = await callApi("/complaints");
  const complaints = Array.isArray(complaintPayload?.complaints) ? complaintPayload.complaints : [];
  const recent30d = complaints.filter((item) => inLastDays(item.createdAt, 30));

  const grouped = new Map();
  for (const complaint of recent30d) {
    const corridorId = complaint.corridorId ?? "unknown";
    grouped.set(corridorId, (grouped.get(corridorId) || 0) + 1);
  }

  const ranking = Array.from(grouped.entries())
    .map(([corridorId, complaintCount]) => ({
      corridorId,
      complaintCount,
      nearingThreshold:
        complaintCount >= CORRIDOR_DENSITY_ALERT_THRESHOLD - 1 && complaintCount < CORRIDOR_DENSITY_ALERT_THRESHOLD,
      highDensity: complaintCount >= CORRIDOR_DENSITY_ALERT_THRESHOLD,
    }))
    .sort((a, b) => b.complaintCount - a.complaintCount);

  return {
    assistant: ranking.length
      ? `Corridor ${ranking[0].corridorId} has the highest complaint density in the last 30 days.`
      : "No complaint density data available in the last 30 days.",
    data: {
      windowDays: 30,
      totalComplaintsConsidered: recent30d.length,
      corridors: ranking,
    },
  };
};
