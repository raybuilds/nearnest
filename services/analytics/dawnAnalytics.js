const prisma = require("../../prismaClient");
const { getUnitOperationalMetrics } = require("./unitAnalytics");

async function getGlobalDashboardAnalytics() {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  const units = await prisma.unit.findMany({
    select: { id: true },
  });

  const metricsList = await Promise.all(
    units.map((u) => getUnitOperationalMetrics(u.id).catch(() => null))
  );

  const validMetrics = metricsList.filter(Boolean);

  // Aggregations
  let totalCompletenessRatios = 0;
  let totalUtilizationRatios = 0;
  let totalVerifDelays = 0;
  let totalOverdueCount = 0;
  let totalVerificationPairs = 0;
  let totalComplaints = 0;
  let totalUnresolvedComplaints = 0;
  let totalUnitsCount = validMetrics.length;

  validMetrics.forEach((m) => {
    // Sum completeness ratios
    const compRatioObj = m.signals.find((s) => s.type === "COMPLIANCE_COMPLETENESS_RATIO");
    if (compRatioObj) {
      totalCompletenessRatios += compRatioObj.value;
    }

    // Sum utilization
    const utilRatioObj = m.signals.find((s) => s.type === "OCCUPANCY_UTILIZATION");
    if (utilRatioObj) {
      totalUtilizationRatios += utilRatioObj.value;
    }

    // Sum verification delays
    const delayObj = m.signals.find((s) => s.type === "PAYMENT_VERIFICATION_DELAY");
    if (delayObj) {
      totalVerifDelays += delayObj.value;
      totalVerificationPairs++;
    }

    // Sum overdue count
    const overdueObj = m.signals.find((s) => s.type === "OVERDUE_PAYMENTS_COUNT");
    if (overdueObj) {
      totalOverdueCount += overdueObj.value;
    }

    // Sum complaints
    const complaintsCount = m.facts.find((f) => f.type === "TOTAL_COMPLAINTS_COUNT");
    if (complaintsCount) {
      totalComplaints += complaintsCount.value;
    }
    const unresolvedCount = m.facts.find((f) => f.type === "UNRESOLVED_COMPLAINTS_COUNT");
    if (unresolvedCount) {
      totalUnresolvedComplaints += unresolvedCount.value;
    }
  });

  // Global facts
  facts.push({
    type: "GLOBAL_UNITS_COUNT",
    value: totalUnitsCount,
    unit: "properties",
    source: "Prisma",
  });

  facts.push({
    type: "GLOBAL_TOTAL_COMPLAINTS",
    value: totalComplaints,
    unit: "complaints",
    source: "Prisma",
  });

  facts.push({
    type: "GLOBAL_UNRESOLVED_COMPLAINTS",
    value: totalUnresolvedComplaints,
    unit: "complaints",
    source: "Prisma",
  });

  // Global signals
  const avgCompleteness = totalUnitsCount > 0 ? totalCompletenessRatios / totalUnitsCount : 0;
  signals.push({
    type: "GLOBAL_AVERAGE_COMPLIANCE_COMPLETENESS",
    value: parseFloat(avgCompleteness.toFixed(2)),
    unit: "ratio",
    source: "Calculation",
  });

  const avgUtilization = totalUnitsCount > 0 ? totalUtilizationRatios / totalUnitsCount : 0;
  signals.push({
    type: "GLOBAL_AVERAGE_OCCUPANCY_UTILIZATION",
    value: parseFloat(avgUtilization.toFixed(2)),
    unit: "ratio",
    source: "Calculation",
  });

  const avgVerifDelay = totalVerificationPairs > 0 ? totalVerifDelays / totalVerificationPairs : 0;
  signals.push({
    type: "GLOBAL_AVERAGE_PAYMENT_VERIFICATION_DELAY",
    value: parseFloat(avgVerifDelay.toFixed(2)),
    unit: "days",
    source: "Calculation",
  });

  signals.push({
    type: "GLOBAL_OVERDUE_PAYMENTS_COUNT",
    value: totalOverdueCount,
    unit: "payments",
    source: "Calculation",
  });

  // Risk emissions
  if (avgCompleteness < 0.85) {
    risks.push({
      type: "GLOBAL_COMPLIANCE_EXPOSURE",
      severity: "MEDIUM",
      message: `Average portfolio compliance completeness stands at ${(avgCompleteness * 100).toFixed(0)}%.`,
      source: "SignalCheck",
    });

    recommendations.push({
      type: "ENFORCE_LANDLORD_COMPLIANCE",
      message: "Advise regional operations team to contact landlords with incomplete compliance documents.",
      triggerSignal: "GLOBAL_AVERAGE_COMPLIANCE_COMPLETENESS",
    });
  }

  if (totalUnresolvedComplaints > 5) {
    risks.push({
      type: "PORTFOLIO_MAINTENANCE_PRESSURE",
      severity: "HIGH",
      message: `There are ${totalUnresolvedComplaints} open complaints unresolved across NearNest corridors.`,
      source: "SignalCheck",
    });

    recommendations.push({
      type: "DEPLOY_SUPPORT_AGENTS",
      message: "Escalate structural safety review teams to governed unit clusters.",
      triggerSignal: "GLOBAL_UNRESOLVED_COMPLAINTS",
    });
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getGlobalDashboardAnalytics };
