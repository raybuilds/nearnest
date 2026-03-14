function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isComplaintDensityIncreasing(corridorMetrics) {
  if (!corridorMetrics || typeof corridorMetrics !== "object") return false;
  if (corridorMetrics.complaintDensityIncreasing === true) return true;

  const current14d = toNumber(corridorMetrics.current14d, null);
  const previous14d = toNumber(corridorMetrics.previous14d, null);
  if (current14d === null || previous14d === null) return false;
  return current14d > previous14d;
}

function getUnitsNearSuspension(corridorMetrics) {
  if (!corridorMetrics || typeof corridorMetrics !== "object") return 0;

  return toNumber(
    corridorMetrics.unitsNearSuspensionThreshold ?? corridorMetrics.unitsNearSuspension,
    0
  );
}

function generateStudentInsights(context) {
  const insights = [];

  if (toNumber(context.trustScore, 100) < 65 && toNumber(context.complaintsLast30Days) >= 2) {
    insights.push("Your unit trust score is declining due to recurring complaints.");
  }

  if (toNumber(context.unresolvedComplaints) >= 1) {
    insights.push("You currently have unresolved complaints affecting trust score.");
  }

  return insights;
}

function generateLandlordInsights(context) {
  const insights = [];

  if (toNumber(context.complaintsLast30Days) >= 3) {
    insights.push("Recurring complaints detected. Consider operational inspection.");
  }

  if (toNumber(context.slaBreaches30Days) >= 2) {
    insights.push("Response delays detected. Faster resolution may improve trust score.");
  }

  return insights;
}

function generateAdminInsights(context) {
  const insights = [];

  if (isComplaintDensityIncreasing(context.corridorMetrics)) {
    insights.push("Complaint density rising in this corridor.");
  }

  if (getUnitsNearSuspension(context.corridorMetrics) >= 2) {
    insights.push("Multiple units approaching suspension threshold.");
  }

  return insights;
}

function generateInsights(context = {}) {
  const role = String(context.userRole || "").toLowerCase();

  if (role === "student") return generateStudentInsights(context);
  if (role === "landlord") return generateLandlordInsights(context);
  if (role === "admin") return generateAdminInsights(context);
  return [];
}

module.exports = {
  generateInsights,
};
