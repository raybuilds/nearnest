function formatStudentSearch(result) {
  const recommendations = Array.isArray(result?.data?.recommendations) ? result.data.recommendations : [];
  if (recommendations.length === 0) {
    return "I could not find matching rooms right now. Try adjusting your filters.";
  }

  const top = recommendations[0];
  return [
    `I found ${result?.data?.totalMatched ?? recommendations.length} rooms matching your request.`,
    `Top recommendation: Unit ${top.id} - Rs ${top.rent} - Trust Score ${top.trustScore} - ${top.distanceKm} km.`,
    "I ranked results by trust, availability, distance, and price.",
  ].join(" ");
}

function formatStudentComplaint(result) {
  if (result?.requiresConfirmation && result?.data?.draft) {
    const draft = result.data.draft;
    return `I prepared a complaint draft (severity ${draft.severity}, ${draft.incidentType}). Confirm and I will submit it.`;
  }
  if (result?.data?.complaintId) {
    return `Complaint #${result.data.complaintId} submitted successfully.`;
  }
  return result?.assistant || "I could not prepare a complaint action right now.";
}

function formatLandlordRecurring(result) {
  const topIssue = result?.data?.topIssues?.[0];
  if (!topIssue) return "No recurring complaint pattern detected in the last 30 days.";
  return `Top recurring issue is ${topIssue.incidentType} with ${topIssue.complaintCount} complaints in 30 days.`;
}

function formatAdminDensity(result) {
  const top = result?.data?.corridors?.[0];
  if (!top) return "No corridor analytics available for the last 30 days.";
  return `Corridor ${top.corridorId} has the highest complaint density (${top.complaintDensity}) and ${top.unitsNearSuspension} units near suspension.`;
}

function formatDawnResponse(intent, result) {
  if (intent === "student_search") return formatStudentSearch(result);
  if (intent === "student_complaint") return formatStudentComplaint(result);
  if (intent === "landlord_recurring") return formatLandlordRecurring(result);
  if (intent === "admin_density") return formatAdminDensity(result);
  return result?.assistant || "Done.";
}

module.exports = {
  formatDawnResponse,
};

