const prisma = require("../../prismaClient");

async function getAgreementMetrics(unitId, occupancyId = null) {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  const whereFilter = occupancyId
    ? { occupancyId }
    : { occupancy: { unitId } };

  const agreements = await prisma.agreement.findMany({
    where: whereFilter,
    orderBy: { version: "desc" },
  });

  if (agreements.length === 0) {
    return { facts, signals, risks, recommendations };
  }

  // Fact: version count
  const versionCount = agreements.length;
  facts.push({
    type: "AGREEMENT_VERSION_COUNT",
    value: versionCount,
    unit: "versions",
    source: "Agreement",
    scope: { unitId, occupancyId },
  });

  // Current status logic (latest version)
  const current = agreements[0];
  facts.push({
    type: "CURRENT_AGREEMENT_STATUS",
    value: current.status,
    unit: "status",
    source: "Agreement",
    scope: { unitId, occupancyId },
  });

  // Count metrics
  let pendingSigs = 0;
  let supersededCount = 0;
  let totalCompletionMs = 0;
  let completedCount = 0;

  agreements.forEach((a) => {
    if (a.status === "PENDING_TENANT" || a.status === "PENDING_LANDLORD") {
      pendingSigs++;
    }
    if (a.status === "SUPERSEDED") {
      supersededCount++;
    }
    if (a.status === "ACTIVE" && a.createdAt) {
      // For signature completion time, let's estimate using updatedAt vs createdAt
      const duration = new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime();
      totalCompletionMs += Math.max(0, duration);
      completedCount++;
    }
  });

  facts.push({
    type: "SUPERSEDED_VERSIONS_COUNT",
    value: supersededCount,
    unit: "records",
    source: "Agreement",
    scope: { unitId, occupancyId },
  });

  signals.push({
    type: "PENDING_SIGNATURES_COUNT",
    value: pendingSigs,
    unit: "agreements",
    source: "Calculation",
    scope: { unitId, occupancyId },
  });

  const avgCompletionDays =
    completedCount > 0 ? (totalCompletionMs / (1000 * 3600 * 24)) / completedCount : 0;

  signals.push({
    type: "SIGNATURE_COMPLETION_TIME",
    value: parseFloat(avgCompletionDays.toFixed(2)),
    unit: "days",
    source: "Calculation",
    scope: { unitId, occupancyId },
  });

  // Expiration Check (using UTC boundaries)
  if (current.status === "ACTIVE") {
    const endTimestamp = new Date(current.endDate).getTime();
    const diffMs = endTimestamp - Date.now();
    const daysRemaining = diffMs / (1000 * 3600 * 24);

    if (daysRemaining > 0 && daysRemaining <= 30) {
      risks.push({
        type: "AGREEMENT_EXPIRATION_APPROACHING",
        severity: "MEDIUM",
        message: `Active agreement is approaching expiration in ${Math.ceil(daysRemaining)} day(s).`,
        source: "SignalCheck",
        scope: { unitId, occupancyId },
      });

      recommendations.push({
        type: "PREPARE_RENEWAL_WORKFLOW",
        message: "Prepare the renewal agreement workflow draft terms for tenant review.",
        triggerSignal: "CURRENT_AGREEMENT_STATUS",
        scope: { unitId, occupancyId },
      });
    }
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getAgreementMetrics };
