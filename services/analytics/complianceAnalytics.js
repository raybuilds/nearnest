const prisma = require("../../prismaClient");

const MANDATORY_DOC_TYPES = ["KYC", "FIRE_SAFETY", "LICENSE", "STRUCTURAL_SAFETY"];

async function getComplianceMetrics(unitId) {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  const compliances = await prisma.unitCompliance.findMany({
    where: { unitId },
  });

  // Calculate status counts
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let expiredCount = 0;
  const approvedTypes = new Set();

  compliances.forEach((c) => {
    // Deterministic expiry mapping check
    const isExpired = c.status === "APPROVED" && c.expiryDate && Date.now() > new Date(c.expiryDate).getTime();
    const effectiveStatus = isExpired ? "EXPIRED" : c.status;

    if (effectiveStatus === "APPROVED") {
      approvedCount++;
      if (MANDATORY_DOC_TYPES.includes(c.docType)) {
        approvedTypes.add(c.docType);
      }
    } else if (effectiveStatus === "PENDING") {
      pendingCount++;
    } else if (effectiveStatus === "REJECTED") {
      rejectedCount++;
    } else if (effectiveStatus === "EXPIRED") {
      expiredCount++;
    }
  });

  facts.push({
    type: "COMPLIANCE_STATUS_DISTRIBUTION",
    value: { APPROVED: approvedCount, PENDING: pendingCount, REJECTED: rejectedCount, EXPIRED: expiredCount },
    unit: "counts",
    source: "UnitCompliance",
    scope: { unitId },
  });

  // Completeness ratio
  const approvedMandatoryDocs = approvedTypes.size;
  const completenessRatio = MANDATORY_DOC_TYPES.length > 0 ? approvedMandatoryDocs / MANDATORY_DOC_TYPES.length : 0;

  signals.push({
    type: "COMPLIANCE_COMPLETENESS_RATIO",
    value: completenessRatio,
    unit: "ratio",
    source: "Calculation",
    scope: { unitId },
  });

  // Compliance exposure risk emission
  if (completenessRatio < 1.0) {
    const missingDocs = MANDATORY_DOC_TYPES.filter((type) => !approvedTypes.has(type));

    risks.push({
      type: "COMPLIANCE_EXPOSURE",
      severity: "HIGH",
      message: `Unit compliance completeness is at ${(completenessRatio * 100).toFixed(0)}%. Missing: ${missingDocs.join(", ")}`,
      source: "SignalCheck",
      scope: { unitId },
    });

    recommendations.push({
      type: "REVIEW_COMPLIANCE_DOCUMENTATION",
      message: `Ensure that all required regulatory documents (${missingDocs.join(", ")}) are submitted and verified.`,
      triggerSignal: "COMPLIANCE_COMPLETENESS_RATIO",
      scope: { unitId },
    });
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getComplianceMetrics, MANDATORY_DOC_TYPES };
