const governanceEvents = require("../governanceEvents");
const { recalculateUnitTrustScore } = require("../trustService");
const { ensureAuditForUnit } = require("../governanceActionService");

function registerAsyncListener(eventName, handler) {
  governanceEvents.on(eventName, (payload) => {
    Promise.resolve(handler(payload)).catch((error) => {
      console.error(`[governanceEvents] ${eventName} listener failed`, error);
    });
  });
}

registerAsyncListener("COMPLAINT_CREATED", async (data) => {
  if (!data?.unitId) return;
  await recalculateUnitTrustScore(data.unitId);
});

registerAsyncListener("COMPLAINT_RESOLVED", async (data) => {
  if (!data?.unitId) return;
  await recalculateUnitTrustScore(data.unitId);
});

registerAsyncListener("SLA_BREACH_DETECTED", async (data) => {
  if (!data?.unitId) return;
  await recalculateUnitTrustScore(data.unitId);
});

registerAsyncListener("OVER_CAPACITY_DETECTED", async (data) => {
  if (!data?.unitId) return;
  await ensureAuditForUnit(data.unitId, {
    triggerType: "capacity_violation",
    reason: data.reason || "Over-capacity detected by governance event listener.",
  });
});

registerAsyncListener("TRUST_SCORE_UPDATED", async (data) => {
  if (!data?.unitId || Number(data?.trustScore) >= 50) return;

  await ensureAuditForUnit(data.unitId, {
    triggerType: "trust_threshold",
    reason: `Trust score dropped below visibility threshold (${Number(data.trustScore)}).`,
  });
});

registerAsyncListener("UNIT_STATUS_CHANGED", async () => {});

module.exports = governanceEvents;
