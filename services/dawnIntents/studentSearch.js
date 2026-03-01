const { ensureRole, parseAcFilter, parseMaxDistance, parseMaxRent } = require("./utils");

module.exports = async function studentSearch({ req, context }) {
  ensureRole(req, ["student"]);

  const { callApi, text } = context;
  const profile = await callApi("/profile");
  const corridorId = profile?.identity?.corridor?.id;

  if (!corridorId) {
    return {
      assistant: "Unable to resolve your corridor context from profile.",
    };
  }

  const filters = {
    maxRent: parseMaxRent(text),
    maxDistance: parseMaxDistance(text),
    ac: parseAcFilter(text),
  };

  const params = new URLSearchParams();
  if (filters.maxRent !== null) params.set("maxRent", String(filters.maxRent));
  if (filters.maxDistance !== null) params.set("maxDistance", String(filters.maxDistance));
  if (filters.ac !== null) params.set("ac", String(filters.ac));

  const path = `/units/${corridorId}${params.toString() ? `?${params.toString()}` : ""}`;
  const units = await callApi(path);
  const sorted = Array.isArray(units)
    ? [...units].sort((a, b) => Number(b.trustScore || 0) - Number(a.trustScore || 0))
    : [];

  return {
    assistant: `Found ${sorted.length} matching units in your corridor. Showing top ${Math.min(sorted.length, 10)} by trust score.`,
    data: {
      filters,
      totalMatched: sorted.length,
      data: sorted.slice(0, 10),
    },
  };
};
