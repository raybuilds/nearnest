const prisma = require("../../prismaClient");

async function getOccupancyMetrics(unitId, occupancyId = null) {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      occupancies: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!unit) {
    return { facts, signals, risks, recommendations };
  }

  // Fact: Unit capacity
  const capacity = unit.capacity || 0;
  facts.push({
    type: "UNIT_CAPACITY",
    value: capacity,
    unit: "slots",
    source: "Unit",
    scope: { unitId },
  });

  // Calculate active occupants (checkoutDate is null or in the future)
  const activeOccupancies = unit.occupancies.filter((occ) => !occ.checkoutDate);
  const activeOccupantsCount = activeOccupancies.length;

  facts.push({
    type: "ACTIVE_OCCUPANT_COUNT",
    value: activeOccupantsCount,
    unit: "students",
    source: "Occupancy",
    scope: { unitId },
  });

  // Signal: occupancy utilization
  const occupancyUtilization = capacity > 0 ? activeOccupantsCount / capacity : 0;
  signals.push({
    type: "OCCUPANCY_UTILIZATION",
    value: occupancyUtilization,
    unit: "ratio",
    source: "Calculation",
    scope: { unitId },
  });

  // Signal: vacancy
  const vacancy = Math.max(0, capacity - activeOccupantsCount);
  signals.push({
    type: "VACANCY_COUNT",
    value: vacancy,
    unit: "slots",
    source: "Calculation",
    scope: { unitId },
  });

  // Signal: occupancy duration & turnover
  const checkedOut = unit.occupancies.filter((occ) => occ.checkoutDate);
  let totalDurationMs = 0;
  checkedOut.forEach((occ) => {
    const start = new Date(occ.startDate).getTime();
    const end = new Date(occ.checkoutDate).getTime();
    totalDurationMs += Math.max(0, end - start);
  });
  const avgDurationDays = checkedOut.length > 0 ? (totalDurationMs / (1000 * 3600 * 24)) / checkedOut.length : 0;

  signals.push({
    type: "AVERAGE_OCCUPANCY_DURATION",
    value: parseFloat(avgDurationDays.toFixed(2)),
    unit: "days",
    source: "Occupancy",
    scope: { unitId },
  });

  signals.push({
    type: "TURNOVER_COUNT",
    value: checkedOut.length,
    unit: "checkouts",
    source: "Occupancy",
    scope: { unitId },
  });

  // Risk: Capacity pressure (>= 95%)
  if (occupancyUtilization >= 0.95) {
    risks.push({
      type: "CAPACITY_PRESSURE",
      severity: "MEDIUM",
      message: "Unit utilization is at or above 95% capacity.",
      source: "SignalCheck",
      scope: { unitId },
    });

    recommendations.push({
      type: "REVIEW_ALTERNATIVE_CAPACITY",
      message: "Review available capacity and readiness of alternative units in the corridor.",
      triggerSignal: "OCCUPANCY_UTILIZATION",
      scope: { unitId },
    });
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getOccupancyMetrics };
