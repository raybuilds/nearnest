const { buildSoftRecommendations, createHttpError, ensureRole, inLastDays, parseRequestedLandlordId } = require("./utils");

module.exports = async function landlordRecurringIssues({ req, context }) {
  ensureRole(req, ["landlord"]);

  const { callApi } = context;
  const profile = await callApi("/profile");
  const ownLandlordId = profile?.identity?.landlordId || null;
  const requestedLandlordId = parseRequestedLandlordId(context.text);
  if (requestedLandlordId !== null && ownLandlordId !== null && requestedLandlordId !== ownLandlordId) {
    throw createHttpError(403, "Dawn can only access your own landlord data");
  }

  const [units, complaintPayload] = await Promise.all([callApi("/landlord/units"), callApi("/complaints")]);
  const complaints = Array.isArray(complaintPayload?.complaints) ? complaintPayload.complaints : [];
  const recent30d = complaints.filter((item) => inLastDays(item.createdAt, 30));

  const grouped = new Map();
  for (const complaint of recent30d) {
    const key = complaint.incidentType || "other";
    if (!grouped.has(key)) {
      grouped.set(key, { incidentType: key, count: 0, unitIds: new Set() });
    }
    const entry = grouped.get(key);
    entry.count += 1;
    if (complaint.unitId) entry.unitIds.add(complaint.unitId);
  }

  const topIssues = Array.from(grouped.values())
    .map((entry) => ({
      incidentType: entry.incidentType,
      complaintCount: entry.count,
      affectedUnits: entry.unitIds.size,
      unitIds: Array.from(entry.unitIds).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.complaintCount - a.complaintCount);

  const slaBreachCount = recent30d.filter((item) => item.slaStatus === "late" || item.slaStatus === "sla_breached").length;
  const trendCurrent14d = complaints.filter((item) => inLastDays(item.createdAt, 14)).length;
  const trendPrevious14d = complaints.filter((item) => {
    if (!item.createdAt) return false;
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const cutoff28 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    return createdAt >= cutoff28 && createdAt < cutoff14;
  }).length;

  const waterIssue = topIssues.find((item) => item.incidentType === "water");
  const suggestions = buildSoftRecommendations({
    waterCount: waterIssue?.complaintCount || 0,
    slaBreachCount,
    trendCurrent14d,
    trendPrevious14d,
  });

  const lead = topIssues[0];
  const leadMessage = lead
    ? `${lead.incidentType} is the top recurring issue with ${lead.complaintCount} complaints in the last 30 days.`
    : "No recurring complaint pattern detected in the last 30 days.";

  return {
    assistant: leadMessage,
    data: {
      unitsCovered: Array.isArray(units) ? units.length : 0,
      topIssues,
      suggestions,
      trend: {
        current14d: trendCurrent14d,
        previous14d: trendPrevious14d,
      },
    },
  };
};
