const { detectIncidentType, ensureRole, estimateSeverity, parseSeverity } = require("./utils");

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

  const { callApi, message, text, confirm, action } = context;
  const profile = await callApi("/profile");
  const studentContext = resolveStudentContext(profile);

  if (!studentContext.unitId) {
    return {
      assistant: "I could not find an active occupancy to bind this complaint. Please occupy a unit first.",
    };
  }

  const incidentType = detectIncidentType(text);
  const severity = parseSeverity(text) || estimateSeverity(text, incidentType);
  const draft = {
    ...(studentContext.occupantId ? { occupantId: studentContext.occupantId } : { unitId: studentContext.unitId }),
    severity,
    incidentType,
    message: message.trim(),
  };

  if (!confirm) {
    return {
      requiresConfirmation: true,
      assistant: "Complaint draft prepared. Confirm to submit.",
      data: {
        preview: {
          unitId: studentContext.unitId,
          occupantBound: Boolean(studentContext.occupantId),
          incidentType,
          severity,
          message: draft.message,
        },
      },
      action: {
        intent: "student_complaint",
        payload: draft,
      },
    };
  }

  const finalPayload = action?.payload || draft;
  const created = await callApi("/complaint", {
    method: "POST",
    body: finalPayload,
  });

  return {
    assistant: "Complaint submitted through the standard complaint API.",
    data: {
      complaintId: created?.complaint?.id || null,
      trustScore: created?.trustScore ?? null,
      incidentType: finalPayload.incidentType,
      severity: finalPayload.severity,
    },
  };
};
