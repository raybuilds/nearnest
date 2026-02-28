const BASE_TRUST = 75;
const RECURRENCE_WINDOW_DAYS = 30;
const RECURRENCE_THRESHOLD = 3;
const RECURRENCE_PENALTY_PER_EXTRA_COMPLAINT = 5;

function isResolvedAfterSla(complaint) {
  if (!complaint.resolved || !complaint.slaDeadline || !complaint.resolvedAt) {
    return false;
  }

  return new Date(complaint.resolvedAt) > new Date(complaint.slaDeadline);
}

function isWithinRecentWindow(complaint, now) {
  if (!complaint.createdAt) {
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
  let base = BASE_TRUST;

  const complaints = unit.complaints || [];
  const now = new Date();

  complaints.forEach((c) => {
    base -= c.severity * 2;

    if (!c.resolved) {
      base -= 5;
    }

    if (isResolvedAfterSla(c)) {
      base -= 3;
    }
  });

  const recentComplaintsCount = complaints.filter((c) => isWithinRecentWindow(c, now)).length;
  const extraRecurringComplaints = Math.max(0, recentComplaintsCount - RECURRENCE_THRESHOLD);
  if (extraRecurringComplaints > 0) {
    base -= extraRecurringComplaints * RECURRENCE_PENALTY_PER_EXTRA_COMPLAINT;
  }

  if (base < 0) base = 0;

  return base;
}

module.exports = { calculateTrustScore };
