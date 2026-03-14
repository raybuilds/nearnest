const { ensureRole, parseAcFilter, parseMaxDistance, parseMaxRent } = require("./utils");
const { rankUnits } = require("../intelligence/dawnRanking");

module.exports = async function studentSearch({ req, context }) {
  ensureRole(req, ["student"]);

  const { callApi, text, memory, updateMemory } = context;
  const profile = await callApi("/profile");
  const corridorId = profile?.identity?.corridor?.id || memory?.lastCorridorId || null;

  if (!corridorId) {
    return {
      assistant: "Unable to resolve your corridor context from profile.",
    };
  }

  const parsedFilters = {
    maxRent: parseMaxRent(text),
    maxDistance: parseMaxDistance(text),
    ac: parseAcFilter(text),
  };
  const previous = memory?.lastSearchFilters || {};
  const contextChained =
    (parsedFilters.maxRent === null && previous.maxRent !== undefined && previous.maxRent !== null) ||
    (parsedFilters.maxDistance === null && previous.maxDistance !== undefined && previous.maxDistance !== null) ||
    (parsedFilters.ac === null && previous.ac !== undefined && previous.ac !== null);

  const filters = {
    maxRent: parsedFilters.maxRent !== null ? parsedFilters.maxRent : previous.maxRent ?? null,
    maxDistance: parsedFilters.maxDistance !== null ? parsedFilters.maxDistance : previous.maxDistance ?? null,
    ac: parsedFilters.ac !== null ? parsedFilters.ac : previous.ac ?? null,
  };

  const params = new URLSearchParams();
  if (filters.maxRent !== null) params.set("maxRent", String(filters.maxRent));
  if (filters.maxDistance !== null) params.set("maxDistance", String(filters.maxDistance));
  if (filters.ac !== null) params.set("ac", String(filters.ac));

  const path = `/units/${corridorId}${params.toString() ? `?${params.toString()}` : ""}`;
  const units = await callApi(path);
  const ranked = rankUnits(Array.isArray(units) ? units : [], filters);
  const recommendations = ranked.slice(0, 5);

  updateMemory({
    lastIntent: "student_search",
    lastCorridorId: corridorId,
    lastSearchFilters: filters,
    lastUnitId: recommendations[0]?.id || null,
  });

  return {
    assistant: `Found ${ranked.length} matching units in your corridor. Showing top ${Math.min(ranked.length, 5)} recommendations.`,
    data: {
      filters,
      contextChained,
      totalMatched: ranked.length,
      recommendations,
      data: recommendations,
    },
  };
};
