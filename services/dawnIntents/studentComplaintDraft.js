const { detectIncidentType, ensureRole, estimateSeverity, parseDuration, parseSeverity } = require("./utils");

function resolveStudentContext(profile) {
  const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  const occupantId =
    profile?.identity?.currentOccupantId ||
    profile?.occupancy?.currentUnit?.occupantId ||
    profile?.currentAccommodation?.identity?.occupantId ||
    null;

  return { unitId, occupantId };
}

module.exports = async function studentComplaintDraft({ req, context }) {
  ensureRole(req, ["student"]);

  const { callApi, message, text, confirm, action, memory, updateMemory, clearMemory } = context;
  const profile = await callApi("/profile");
  const studentContext = resolveStudentContext(profile);

  if (!studentContext.unitId) {
    return {
      assistant: "I could not find an active occupancy to bind this complaint. Please occupy a unit first.",
    };
  }

  const detectedIncidentType = detectIncidentType(text);
  const incidentType =
    detectedIncidentType !== "other"
      ? detectedIncidentType
      : memory?.lastComplaintDraft?.incidentType || detectedIncidentType;
  const severity = parseSeverity(text) || memory?.lastComplaintDraft?.severity || null;
  const duration = parseDuration(text) || memory?.lastComplaintDraft?.duration || null;
  const estimatedSeverity = severity || estimateSeverity(text, incidentType);
  const baseMessage =
    memory?.lastComplaintDraft?.message &&
    (parseSeverity(text) || parseDuration(text)) &&
    detectedIncidentType === "other"
      ? String(memory.lastComplaintDraft.message).replace(/\s*Duration reported:.*$/i, "").trim()
      : message.trim();
  const draftMessage = duration ? `${baseMessage} Duration reported: ${duration}.` : baseMessage;
  const draft = {
    ...(studentContext.occupantId ? { occupantId: studentContext.occupantId } : { unitId: studentContext.unitId }),
    severity: estimatedSeverity,
    incidentType,
    duration,
    message: draftMessage,
    requiresConfirmation: true,
  };

  const missingFields = [];
  if (!severity) missingFields.push("severity");
  if (!duration) missingFields.push("duration");

  if (!confirm && missingFields.length > 0) {
    updateMemory({
      lastIntent: "student_complaint",
      lastUnitId: studentContext.unitId,
      lastComplaintDraft: draft,
      pendingFollowUp: {
        intent: "student_complaint",
        missingFields,
      },
    });

    return {
      requiresConfirmation: false,
      assistant:
        missingFields.length === 2
          ? "I can draft this complaint. First tell me the severity from 1 to 5 and how long this issue has been happening."
          : missingFields[0] === "severity"
            ? "I can draft this complaint. What severity should I use from 1 to 5?"
            : "I can draft this complaint. How long has this issue been happening?",
      data: {
        draft: {
          severity: draft.severity,
          incidentType: draft.incidentType,
          duration: draft.duration,
          message: message.trim(),
        },
        preview: {
          unitId: studentContext.unitId,
          occupantBound: Boolean(studentContext.occupantId),
          incidentType,
          severity: draft.severity,
          duration,
          message: message.trim(),
        },
        missingFields,
      },
    };
  }

  if (!confirm) {
    updateMemory({
      lastIntent: "student_complaint",
      lastUnitId: studentContext.unitId,
      lastComplaintDraft: draft,
      pendingFollowUp: null,
    });

    return {
      requiresConfirmation: true,
      assistant: "Complaint draft prepared. Review the preview and confirm to submit it.",
      data: {
        draft: {
          severity: draft.severity,
          incidentType: draft.incidentType,
          duration: draft.duration,
          message: draft.message,
          requiresConfirmation: true,
        },
        preview: {
          unitId: studentContext.unitId,
          occupantBound: Boolean(studentContext.occupantId),
          incidentType,
          severity: draft.severity,
          duration: draft.duration,
          message: draft.message,
        },
      },
      action: {
        intent: "student_complaint",
        payload: draft,
      },
    };
  }

  const finalPayload = action?.payload || memory?.lastComplaintDraft || draft;
  if (!finalPayload || !finalPayload.severity || !finalPayload.incidentType) {
    return {
      assistant: "No complaint draft was found. Please describe the issue first so I can prepare it.",
    };
  }

  const created = await callApi("/complaint", {
    method: "POST",
    body: finalPayload,
  });
  clearMemory("lastComplaintDraft");
  updateMemory({
    lastIntent: "student_complaint",
    lastUnitId: studentContext.unitId,
    lastComplaintDraft: null,
    pendingFollowUp: null,
  });

  return {
    assistant: "Complaint submitted through the standard complaint API.",
    data: {
      complaintId: created?.complaint?.id || null,
      trustScore: created?.trustScore ?? null,
      incidentType: finalPayload.incidentType,
      severity: finalPayload.severity,
      duration: finalPayload.duration || null,
    },
  };
};
