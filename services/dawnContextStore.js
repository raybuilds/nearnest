const CONTEXT_TTL_MS = 10 * 60 * 1000;
const store = new Map();

function now() {
  return Date.now();
}

function createDefaultContext() {
  return {
    lastIntent: null,
    lastCorridorId: null,
    lastUnitId: null,
    lastSearchFilters: null,
    lastComplaintDraft: null,
    lastViewedUnitId: null,
    lastKnownTrustScore: null,
    lastKnownComplaintCount: null,
    lastKnownRiskLevel: null,
    currentUnitId: null,
    currentCorridorId: null,
    currentTrustScore: null,
    currentActiveComplaints: null,
    pendingFollowUp: null,
  };
}

function getRecord(userId) {
  const key = String(userId || "");
  if (!key) return null;
  const record = store.get(key);
  if (!record) return null;
  if (record.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return record;
}

function getContext(userId) {
  const record = getRecord(userId);
  return record ? { ...record.context } : createDefaultContext();
}

function updateContext(userId, patch) {
  const key = String(userId || "");
  if (!key) return createDefaultContext();

  const current = getContext(key);
  const next = {
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
  };

  store.set(key, {
    context: next,
    expiresAt: now() + CONTEXT_TTL_MS,
  });
  return { ...next };
}

function clearContext(userId) {
  const key = String(userId || "");
  if (!key) return;
  store.delete(key);
}

module.exports = {
  CONTEXT_TTL_MS,
  getContext,
  updateContext,
  clearContext,
};

