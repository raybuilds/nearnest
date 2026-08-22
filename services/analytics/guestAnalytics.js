const prisma = require("../../prismaClient");

async function getGuestMetrics(unitId, occupancyId = null, config = { maxDurationHours: 72 }) {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  const whereFilter = occupancyId
    ? { occupancyId }
    : { occupancy: { unitId } };

  const guestStays = await prisma.guestStay.findMany({
    where: whereFilter,
  });

  if (guestStays.length === 0) {
    return { facts, signals, risks, recommendations };
  }

  // Calculate stays counts
  const totalStays = guestStays.length;
  const activeStays = guestStays.filter((g) => g.active).length;

  facts.push({
    type: "TOTAL_GUEST_STAYS",
    value: totalStays,
    unit: "stays",
    source: "GuestStay",
    scope: { unitId, occupancyId },
  });

  facts.push({
    type: "ACTIVE_GUEST_COUNT",
    value: activeStays,
    unit: "guests",
    source: "GuestStay",
    scope: { unitId, occupancyId },
  });

  // Calculate durations (hours)
  let totalDurationMs = 0;
  let completedStaysCount = 0;
  const monthlyHoursMap = {};

  guestStays.forEach((g) => {
    const start = new Date(g.startDate);
    const end = g.endDate ? new Date(g.endDate) : new Date();
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    totalDurationMs += durationMs;

    if (!g.active) {
      completedStaysCount++;
    }

    // Monthly volume breakdown
    const yearMonth = start.toISOString().substring(0, 7); // "YYYY-MM"
    monthlyHoursMap[yearMonth] = (monthlyHoursMap[yearMonth] || 0) + (durationMs / (1000 * 3600));
  });

  const avgDurationHours = completedStaysCount > 0 ? (totalDurationMs / (1000 * 3600)) / guestStays.length : 0;

  signals.push({
    type: "AVERAGE_GUEST_DURATION",
    value: parseFloat(avgDurationHours.toFixed(1)),
    unit: "hours",
    source: "Calculation",
    scope: { unitId, occupancyId },
  });

  signals.push({
    type: "MONTHLY_GUEST_VOLUME",
    value: monthlyHoursMap,
    unit: "hours",
    source: "Calculation",
    scope: { unitId, occupancyId },
  });

  // Check for extended stay warning
  if (avgDurationHours >= config.maxDurationHours) {
    risks.push({
      type: "EXTENDED_GUEST_STAY_PATTERN",
      severity: "LOW",
      message: `Average registered guest duration of ${avgDurationHours.toFixed(1)} hours exceeds the ${config.maxDurationHours}-hour warning threshold.`,
      source: "SignalCheck",
      scope: { unitId, occupancyId },
    });

    recommendations.push({
      type: "REVIEW_GUEST_STAY_POLICY",
      message: "Review applicable guest-stay policies regarding overnight visitors and host guidelines.",
      triggerSignal: "AVERAGE_GUEST_DURATION",
      scope: { unitId, occupancyId },
    });
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getGuestMetrics };
