const { ensureRole, inLastDays } = require("./utils");

const CORRIDOR_DENSITY_ALERT_THRESHOLD = 5;
const ENFORCEMENT_WARNING_THRESHOLD = 4;

module.exports = async function adminCorridorAnalytics({ req, context }) {
  ensureRole(req, ["admin"]);

  const { callApi, updateMemory } = context;
  const complaintPayload = await callApi("/complaints");
  const complaints = Array.isArray(complaintPayload?.complaints) ? complaintPayload.complaints : [];
  const corridors = await callApi("/corridors").catch(() => []);

  const recent30d = complaints.filter((item) => inLastDays(item.createdAt, 30));
  const now = Date.now();
  const msDay = 24 * 60 * 60 * 1000;

  const rows = [];
  for (const corridor of Array.isArray(corridors) ? corridors : []) {
    const corridorId = corridor.id;
    const corridorComplaints = complaints.filter((item) => item.corridorId === corridorId);
    const complaintDensity = corridorComplaints.filter((item) => inLastDays(item.createdAt, 30)).length;
    const current14d = corridorComplaints.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt = new Date(item.createdAt).getTime();
      return !Number.isNaN(createdAt) && createdAt >= now - 14 * msDay;
    }).length;
    const previous14d = corridorComplaints.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt = new Date(item.createdAt).getTime();
      return !Number.isNaN(createdAt) && createdAt >= now - 28 * msDay && createdAt < now - 14 * msDay;
    }).length;
    const trustTrend =
      current14d > previous14d
        ? "deteriorating"
        : current14d < previous14d
          ? "improving"
          : "stable";

    const units = await callApi(`/admin/units/${Number(corridorId)}`).catch(() => []);
    const overview = await callApi(`/corridor/${Number(corridorId)}/overview`).catch(() => null);
    const unitList = Array.isArray(units) ? units : [];
    const unitsNearSuspension = unitList.filter((item) => Number(item?.trustScore || 0) <= 55 || item?.auditRequired).length;
    const riskLevel = String(overview?.riskSummary?.riskLevel || overview?.behavioralInsights?.riskLevel || "LOW");
    const severeIncidents = Number(overview?.riskSummary?.severeIncidents || overview?.behavioralInsights?.severeIncidents || 0);

    const warnings = [];
    if (complaintDensity >= ENFORCEMENT_WARNING_THRESHOLD || unitsNearSuspension > 0) {
      warnings.push(`Corridor ${corridorId} approaching enforcement threshold.`);
    }
    if (complaintDensity >= CORRIDOR_DENSITY_ALERT_THRESHOLD) {
      warnings.push(`Corridor ${corridorId} has high complaint density.`);
    }
    if (riskLevel === "HIGH") {
      warnings.push(`Corridor ${corridorId} is currently classified as HIGH risk.`);
    } else if (riskLevel === "MEDIUM") {
      warnings.push(`Corridor ${corridorId} is currently classified as MEDIUM risk.`);
    }

    rows.push({
      corridorId,
      corridorName: corridor.name,
      complaintDensity,
      riskLevel,
      severeIncidents,
      trustTrend,
      unitsNearSuspension,
      trend14d: {
        current14d,
        previous14d,
      },
      warnings,
    });
  }

  const ranking = rows.sort((a, b) => b.complaintDensity - a.complaintDensity);
  updateMemory({
    lastIntent: "admin_density",
    lastCorridorId: ranking[0]?.corridorId || null,
  });

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
