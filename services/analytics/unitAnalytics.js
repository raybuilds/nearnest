const prisma = require("../../prismaClient");
const { getOccupancyMetrics } = require("./occupancyAnalytics");
const { getPaymentMetrics } = require("./paymentAnalytics");
const { getGuestMetrics } = require("./guestAnalytics");
const { getAgreementMetrics } = require("./agreementAnalytics");
const { getComplianceMetrics } = require("./complianceAnalytics");

async function getUnitOperationalMetrics(unitId, occupancyId = null) {
  const mergedFacts = [];
  const mergedSignals = [];
  const mergedRisks = [];
  const mergedRecommendations = [];

  // 1. Fetch sub-domain metrics concurrently
  const [occRes, payRes, guestRes, aggRes, compRes] = await Promise.all([
    getOccupancyMetrics(unitId, occupancyId).catch(() => ({ facts: [], signals: [], risks: [], recommendations: [] })),
    getPaymentMetrics(unitId, occupancyId).catch(() => ({ facts: [], signals: [], risks: [], recommendations: [] })),
    getGuestMetrics(unitId, occupancyId).catch(() => ({ facts: [], signals: [], risks: [], recommendations: [] })),
    getAgreementMetrics(unitId, occupancyId).catch(() => ({ facts: [], signals: [], risks: [], recommendations: [] })),
    getComplianceMetrics(unitId).catch(() => ({ facts: [], signals: [], risks: [], recommendations: [] })),
  ]);

  // Merge them
  const results = [occRes, payRes, guestRes, aggRes, compRes];
  results.forEach((res) => {
    if (res.facts) mergedFacts.push(...res.facts);
    if (res.signals) mergedSignals.push(...res.signals);
    if (res.risks) mergedRisks.push(...res.risks);
    if (res.recommendations) mergedRecommendations.push(...res.recommendations);
  });

  // 2. Add Unit Specific Complaints & Readiness Checklist facts
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      complaints: true,
    },
  });

  if (unit) {
    // Complaint facts
    const totalComplaints = unit.complaints.length;
    const unresolvedComplaints = unit.complaints.filter((c) => !c.resolved).length;

    mergedFacts.push({
      type: "TOTAL_COMPLAINTS_COUNT",
      value: totalComplaints,
      unit: "complaints",
      source: "Complaint",
      scope: { unitId },
    });

    mergedFacts.push({
      type: "UNRESOLVED_COMPLAINTS_COUNT",
      value: unresolvedComplaints,
      unit: "complaints",
      source: "Complaint",
      scope: { unitId },
    });

    // Checklists facts
    const structuralOk = unit.structuralChecklist && Object.values(unit.structuralChecklist).every(v => v === true);
    const operationalOk = unit.operationalChecklist && Object.values(unit.operationalChecklist).every(v => v === true);

    mergedFacts.push({
      type: "STRUCTURAL_CHECKLIST_READY",
      value: Boolean(structuralOk),
      unit: "boolean",
      source: "Unit",
      scope: { unitId },
    });

    mergedFacts.push({
      type: "OPERATIONAL_CHECKLIST_READY",
      value: Boolean(operationalOk),
      unit: "boolean",
      source: "Unit",
      scope: { unitId },
    });

    // Emit complaint/checklist operational risks
    if (unresolvedComplaints > 0) {
      mergedRisks.push({
        type: "UNRESOLVED_COMPLAINT_EXPOSURE",
        severity: "HIGH",
        message: `Detected ${unresolvedComplaints} unresolved tenant complaints.`,
        source: "SignalCheck",
        scope: { unitId },
      });

      mergedRecommendations.push({
        type: "REMEDIATE_OPEN_COMPLAINTS",
        message: "Coordinate with the landlord and service technicians to resolve pending maintenance claims.",
        triggerSignal: "UNRESOLVED_COMPLAINTS_COUNT",
        scope: { unitId },
      });
    }

    if (!structuralOk || !operationalOk) {
      mergedRisks.push({
        type: "READINESS_CHECKLIST_EXPOSURE",
        severity: "MEDIUM",
        message: "Readiness checklists are incomplete or report failures.",
        source: "SignalCheck",
        scope: { unitId },
      });

      mergedRecommendations.push({
        type: "UPDATE_READINESS_CHECKLISTS",
        message: "Review structural safety checklists and fill operational checklists on the unit page.",
        triggerSignal: "STRUCTURAL_CHECKLIST_READY",
        scope: { unitId },
      });
    }
  }

  return {
    facts: mergedFacts,
    signals: mergedSignals,
    risks: mergedRisks,
    recommendations: mergedRecommendations,
  };
}

module.exports = { getUnitOperationalMetrics };
