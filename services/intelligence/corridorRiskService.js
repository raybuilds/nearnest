const prisma = require("../../prismaClient");

const RISK_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
};

function getLast30DaysCutoff() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function computeRiskLevel({ complaintDensity, severeIncidents, unitsNearSuspension }) {
  if (complaintDensity > 3 || severeIncidents > 2) {
    return RISK_LEVELS.HIGH;
  }

  if (unitsNearSuspension > 2) {
    return RISK_LEVELS.MEDIUM;
  }

  return RISK_LEVELS.LOW;
}

async function analyzeCorridorRisk(corridorId) {
  const resolvedCorridorId = Number(corridorId);
  if (Number.isNaN(resolvedCorridorId)) {
    const error = new Error("corridorId must be a number");
    error.statusCode = 400;
    throw error;
  }

  const cutoff = getLast30DaysCutoff();
  const [unitCount, complaints, unitsNearSuspension, demandMetrics] = await Promise.all([
    prisma.unit.count({
      where: { corridorId: resolvedCorridorId },
    }),
    prisma.complaint.findMany({
      where: {
        unit: { corridorId: resolvedCorridorId },
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        severity: true,
        resolved: true,
      },
    }),
    prisma.unit.count({
      where: {
        corridorId: resolvedCorridorId,
        trustScore: { lt: 55 },
      },
    }),
    prisma.vDPEntry.count({
      where: {
        corridorId: resolvedCorridorId,
        verified: true,
      },
    }),
  ]);

  const totalComplaints = complaints.length;
  const complaintDensity = unitCount === 0 ? 0 : Number((totalComplaints / unitCount).toFixed(2));
  const severeIncidents = complaints.filter((complaint) => Number(complaint.severity || 0) >= 4).length;
  const unresolvedComplaints = complaints.filter((complaint) => !complaint.resolved).length;
  const riskLevel = computeRiskLevel({
    complaintDensity,
    severeIncidents,
    unitsNearSuspension,
  });

  return {
    corridorId: resolvedCorridorId,
    riskLevel,
    complaintDensity,
    severeIncidents,
    unitsNearSuspension,
    unresolvedComplaints,
    vdpDemandSignals: demandMetrics,
  };
}

module.exports = {
  RISK_LEVELS,
  analyzeCorridorRisk,
};
