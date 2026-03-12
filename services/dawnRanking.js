function clamp(value, min = 0, max = 1) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function availabilityScore(unit) {
  const capacity = Number(unit?.capacity || 0);
  const occupancyCount = Number(unit?.occupancyCount || 0);
  if (capacity <= 0) return 0;
  const available = Math.max(0, capacity - occupancyCount);
  return clamp(available / capacity);
}

function distanceScore(unit, filters) {
  const distance = Number(unit?.distanceKm);
  if (Number.isNaN(distance)) return 0;
  const maxDistance = Number(filters?.maxDistance);
  if (!Number.isNaN(maxDistance) && maxDistance > 0) {
    return clamp((maxDistance - distance) / maxDistance);
  }
  return clamp(1 / (1 + distance));
}

function priceScore(unit, filters) {
  const rent = Number(unit?.rent);
  if (Number.isNaN(rent) || rent < 0) return 0;
  const maxRent = Number(filters?.maxRent);
  if (!Number.isNaN(maxRent) && maxRent > 0) {
    return clamp((maxRent - rent) / maxRent);
  }
  return clamp(1 / (1 + rent / 10000));
}

function computeRankingScore(unit, filters = {}) {
  const trust = clamp(Number(unit?.trustScore || 0) / 100);
  const availability = availabilityScore(unit);
  const distance = distanceScore(unit, filters);
  const price = priceScore(unit, filters);

  const weighted =
    trust * 0.5 +
    availability * 0.2 +
    distance * 0.2 +
    price * 0.1;

  return Number((weighted * 100).toFixed(2));
}

function rankUnits(units, filters = {}) {
  const list = Array.isArray(units) ? units : [];
  return list
    .map((unit) => {
      const occupancyCount = Number(unit?.occupancyCount || 0);
      const capacity = Number(unit?.capacity || 0);
      const availableSlots = capacity > 0 ? Math.max(0, capacity - occupancyCount) : 0;
      const rankingScore = computeRankingScore(unit, filters);

      return {
        ...unit,
        rankingScore,
        availableSlots,
        recommendationReasons: [
          `trust score ${Number(unit?.trustScore || 0)}`,
          `rent Rs ${Number(unit?.rent || 0)}`,
          `${availableSlots} available slot${availableSlots === 1 ? "" : "s"}`,
          `${Number(unit?.distanceKm || 0)} km away`,
        ],
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore || Number(b.trustScore || 0) - Number(a.trustScore || 0));
}

module.exports = {
  computeRankingScore,
  rankUnits,
};

