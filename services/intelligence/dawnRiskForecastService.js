const prisma = require("../../prismaClient");

function getWindowCutoff(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isWithinRange(dateValue, start, end = new Date()) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
}

function isSlaBreached(complaint) {
  if (!complaint?.slaDeadline) return false;
  const deadline = new Date(complaint.slaDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  if (!complaint.resolved) {
    return Date.now() > deadline.getTime();
  }

  if (!complaint.resolvedAt) return false;
  const resolvedAt = new Date(complaint.resolvedAt);
  if (Number.isNaN(resolvedAt.getTime())) return false;
  return resolvedAt > deadline;
}

function toRiskLevel(riskScore) {
  if (riskScore >= 2.5) return "CRITICAL";
  if (riskScore >= 1.2) return "EARLY_WARNING";
  return "STABLE";
}

async function forecastUnitRisk(unitId) {
  const resolvedUnitId = Number(unitId);
  if (Number.isNaN(resolvedUnitId)) {
    const error = new Error("unitId must be a number");
    error.statusCode = 400;
    throw error;
  }

  const unit = await prisma.unit.findUnique({
    where: { id: resolvedUnitId },
    include: {
      complaints: {
        select: {
          severity: true,
          resolved: true,
          createdAt: true,
          resolvedAt: true,
          slaDeadline: true,
        },
      },
      occupancies: {
        where: { endDate: null },
        select: { id: true },
      },
    },
  });

  if (!unit) {
    const error = new Error("Unit not found");
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const cutoff30 = getWindowCutoff(30);
  const cutoff14 = getWindowCutoff(14);
  const cutoff28 = getWindowCutoff(28);

  const complaints30d = unit.complaints.filter((item) => isWithinRange(item.createdAt, cutoff30, now));
  const current14d = complaints30d.filter((item) => isWithinRange(item.createdAt, cutoff14, now)).length;
  const previous14d = complaints30d.filter((item) => isWithinRange(item.createdAt, cutoff28, cutoff14)).length;
  const complaintTrend = Math.max(0, current14d - previous14d);

  const severeComplaints30d = complaints30d.filter((item) => Number(item.severity || 0) >= 4).length;
  const severityTrend = severeComplaints30d;
  const slaBreaches = complaints30d.filter(isSlaBreached).length;

  const activeOccupancy = Array.isArray(unit.occupancies) ? unit.occupancies.length : 0;
  const occupancyPressure =
    Number(unit.capacity || 0) > 0 ? Number((activeOccupancy / Number(unit.capacity)).toFixed(2)) : 0;

  const trustScoreTrend = Math.max(0, Number((75 - Number(unit.trustScore || 0)) / 10).toFixed(2));

  const rawRiskScore =
    complaintTrend * 0.4 +
    slaBreaches * 0.3 +
    severityTrend * 0.2 +
    occupancyPressure * 0.1 +
    trustScoreTrend * 0.2;
  const riskScore = Number(rawRiskScore.toFixed(2));
  const riskLevel = toRiskLevel(riskScore);

  const indicators = [];
  if (complaintTrend > 0) {
    indicators.push("Complaint frequency rising");
  }
  if (slaBreaches >= 2) {
    indicators.push("Multiple SLA breaches detected");
  }
  if (severityTrend >= 2) {
    indicators.push("Severe complaints increasing");
  }
  if (trustScoreTrend >= 1.5 || Number(unit.trustScore || 0) < 60) {
    indicators.push("Trust score trending downward");
  }
  if (occupancyPressure >= 0.9) {
    indicators.push("Occupancy pressure is high");
  }

  let recommendation = "Continue monitoring this unit through standard health checks.";
  if (riskLevel === "EARLY_WARNING") {
    recommendation = "Monitor this unit closely and resolve new complaints quickly.";
  } else if (riskLevel === "CRITICAL") {
    recommendation = "This unit needs immediate operational attention and rapid complaint resolution.";
  }

  return {
    unitId: resolvedUnitId,
    riskLevel,
    riskScore,
    indicators,
    recommendation,
    complaintTrend,
    severityTrend,
    slaBreaches,
    occupancyPressure,
    trustScoreTrend,
  };
}

module.exports = {
  forecastUnitRisk,
};
