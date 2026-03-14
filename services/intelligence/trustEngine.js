const BASE_TRUST = 75;
const RECURRENCE_WINDOW_DAYS = 30;
const RECURRENCE_THRESHOLD = 3;
const RECURRENCE_PENALTY_PER_EXTRA_COMPLAINT = 5;

function isResolvedAfterSla(complaint) {
  if (!complaint?.resolved || !complaint?.slaDeadline || !complaint?.resolvedAt) {
    return false;
  }

  return new Date(complaint.resolvedAt) > new Date(complaint.slaDeadline);
}

function isWithinRecentWindow(complaint, now = new Date()) {
  if (!complaint?.createdAt) {
    return false;
  }

  const createdAt = new Date(complaint.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const cutoff = new Date(now.getTime() - RECURRENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return createdAt >= cutoff;
}

function calculateTrustScore(unit) {
  let score = BASE_TRUST;
  const complaints = Array.isArray(unit?.complaints) ? unit.complaints : [];
  const now = new Date();

  complaints.forEach((complaint) => {
    score -= Number(complaint?.severity || 0) * 2;

    if (!complaint?.resolved) {
      score -= 5;
    }

    if (isResolvedAfterSla(complaint)) {
      score -= 3;
    }
  });

  const recentComplaintsCount = complaints.filter((complaint) => isWithinRecentWindow(complaint, now)).length;
  const extraRecurringComplaints = Math.max(0, recentComplaintsCount - RECURRENCE_THRESHOLD);
  if (extraRecurringComplaints > 0) {
    score -= extraRecurringComplaints * RECURRENCE_PENALTY_PER_EXTRA_COMPLAINT;
  }

  return Math.max(0, score);
}

module.exports = {
  BASE_TRUST,
  RECURRENCE_PENALTY_PER_EXTRA_COMPLAINT,
  RECURRENCE_THRESHOLD,
  RECURRENCE_WINDOW_DAYS,
  calculateTrustScore,
  isResolvedAfterSla,
  isWithinRecentWindow,
};
