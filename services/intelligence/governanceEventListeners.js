const governanceEvents = require("../governanceEvents");
const { recalculateUnitTrustScore } = require("../trustService");
const { ensureAuditForUnit } = require("../governanceActionService");
const { createAlert, resolveRecipients } = require("../alerts/alertManager");

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

  // Generate database alert
  const recipients = await resolveRecipients({ unitId: data.unitId, complaintId: data.id });
  for (const recId of recipients) {
    await createAlert({
      recipientId: recId,
      type: "UNRESOLVED_COMPLAINT",
      severity: "MEDIUM",
      sourceEntity: "complaint",
      sourceId: data.id || 9999, // default to safeguard if data.id missing
      title: "Complaint Created",
      message: data.message || "A new complaint has been filed for this unit.",
      unitId: data.unitId,
      complaintId: data.id,
    });
  }
});

registerAsyncListener("COMPLAINT_RESOLVED", async (data) => {
  if (!data?.unitId) return;
  await recalculateUnitTrustScore(data.unitId);
});

registerAsyncListener("SLA_BREACH_DETECTED", async (data) => {
  if (!data?.unitId) return;
  await recalculateUnitTrustScore(data.unitId);

  // Generate database alert
  const recipients = await resolveRecipients({ unitId: data.unitId, complaintId: data.id });
  for (const recId of recipients) {
    await createAlert({
      recipientId: recId,
      type: "SLA_BREACH",
      severity: "HIGH",
      sourceEntity: "complaint",
      sourceId: data.id || 9999,
      title: "SLA Deadline Breached",
      message: `A complaint SLA deadline was breached for unit #${data.unitId}.`,
      unitId: data.unitId,
      complaintId: data.id,
    });
  }
});

registerAsyncListener("OVER_CAPACITY_DETECTED", async (data) => {
  if (!data?.unitId) return;
  await ensureAuditForUnit(data.unitId, {
    triggerType: "capacity_violation",
    reason: data.reason || "Over-capacity detected by governance event listener.",
  });

  // Generate database alert
  const recipients = await resolveRecipients({ unitId: data.unitId });
  for (const recId of recipients) {
    await createAlert({
      recipientId: recId,
      type: "CAPACITY_PRESSURE",
      severity: "CRITICAL",
      sourceEntity: "unit",
      sourceId: data.unitId,
      title: "Over-Capacity Detected",
      message: data.reason || "Over-capacity detected by governance checker.",
      unitId: data.unitId,
    });
  }
});

registerAsyncListener("TRUST_SCORE_UPDATED", async (data) => {
  if (!data?.unitId || Number(data?.trustScore) >= 50) return;

  await ensureAuditForUnit(data.unitId, {
    triggerType: "trust_threshold",
    reason: `Trust score dropped below visibility threshold (${Number(data.trustScore)}).`,
  });

  // Generate database alert
  const recipients = await resolveRecipients({ unitId: data.unitId });
  for (const recId of recipients) {
    await createAlert({
      recipientId: recId,
      type: "TRUST_THRESHOLD_ALERT",
      severity: "HIGH",
      sourceEntity: "unit",
      sourceId: data.unitId,
      title: "Trust Score Threshold Warning",
      message: `Trust score dropped below visibility threshold (${Number(data.trustScore)}).`,
      unitId: data.unitId,
    });
  }
});

registerAsyncListener("UNIT_STATUS_CHANGED", async () => {});

module.exports = governanceEvents;
