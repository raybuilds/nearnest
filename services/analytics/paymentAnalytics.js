const prisma = require("../../prismaClient");

/**
 * Phase 7 Payment Due-Date Policy:
 * Since there is no formal `dueDate` column in the database, the due date is deterministically
 * assumed to be the 5th day of the target month (e.g., for month "2026-08", the due date is August 5, 2026).
 * Payments not PAID or VERIFIED by this day are flagged in the overdue patterns analysis.
 */
function getPaymentDueDate(monthStr) {
  // monthStr is expected to be "YYYY-MM"
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return null;
  }
  const [year, month] = monthStr.split("-").map(Number);
  // Due date is the 5th of that month at 23:59:59 UTC
  return new Date(Date.UTC(year, month - 1, 5, 23, 59, 59));
}

async function getPaymentMetrics(unitId, occupancyId = null) {
  const facts = [];
  const signals = [];
  const risks = [];
  const recommendations = [];

  // Filter query parameters based on scope (occupancyId takes precedence for isolation)
  const whereFilter = occupancyId
    ? { occupancyId }
    : { occupancy: { unitId } };

  const payments = await prisma.payment.findMany({
    where: whereFilter,
    include: {
      audits: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { month: "asc" },
  });

  if (payments.length === 0) {
    return { facts, signals, risks, recommendations };
  }

  // Facts & status distributions
  let pendingCount = 0;
  let paidCount = 0;
  let verifiedCount = 0;
  let totalPendingAmount = 0;

  payments.forEach((p) => {
    if (p.status === "PENDING") {
      pendingCount++;
      totalPendingAmount += p.amount;
    } else if (p.status === "PAID") {
      paidCount++;
    } else if (p.status === "VERIFIED") {
      verifiedCount++;
    }
  });

  facts.push({
    type: "PAYMENT_STATUS_DISTRIBUTION",
    value: { PENDING: pendingCount, PAID: paidCount, VERIFIED: verifiedCount },
    unit: "counts",
    source: "Payment",
    scope: { unitId, occupancyId },
  });

  facts.push({
    type: "PENDING_OBLIGATIONS_AMOUNT",
    value: totalPendingAmount,
    unit: "INR",
    source: "Payment",
    scope: { unitId, occupancyId },
  });

  // Calculate verification delay and overdue occurrences
  let totalVerificationDelayMs = 0;
  let verifiedAuditPairs = 0;
  let overdueCount = 0;

  payments.forEach((p) => {
    // Overdue check based on Phase 7 policy
    const dueDate = getPaymentDueDate(p.month);
    if (dueDate) {
      // Find when it was submitted (transitioned to PAID)
      const paidAudit = p.audits.find(
        (a) => a.action === "SUBMIT" || (a.changes && typeof a.changes === "object" && a.changes.status && a.changes.status.new === "PAID")
      );
      const paymentTime = paidAudit ? new Date(paidAudit.createdAt) : new Date(p.createdAt);

      if (p.status === "PENDING" && Date.now() > dueDate.getTime()) {
        overdueCount++;
      } else if (p.status !== "PENDING" && paymentTime.getTime() > dueDate.getTime()) {
        overdueCount++;
      }
    }

    // Delay check from PaymentAudit trail
    const paidAudit = p.audits.find((a) => a.changes && typeof a.changes === "object" && a.changes.status && a.changes.status.new === "PAID");
    const verifiedAudit = p.audits.find((a) => a.changes && typeof a.changes === "object" && a.changes.status && a.changes.status.new === "VERIFIED");

    if (paidAudit && verifiedAudit) {
      const delay = new Date(verifiedAudit.createdAt).getTime() - new Date(paidAudit.createdAt).getTime();
      totalVerificationDelayMs += Math.max(0, delay);
      verifiedAuditPairs++;
    }
  });

  const avgVerificationDelayDays =
    verifiedAuditPairs > 0 ? (totalVerificationDelayMs / (1000 * 3600 * 24)) / verifiedAuditPairs : 0;

  signals.push({
    type: "PAYMENT_VERIFICATION_DELAY",
    value: parseFloat(avgVerificationDelayDays.toFixed(2)),
    unit: "days",
    source: "PaymentAudit",
    scope: { unitId, occupancyId },
  });

  signals.push({
    type: "OVERDUE_PAYMENTS_COUNT",
    value: overdueCount,
    unit: "payments",
    source: "Calculation",
    scope: { unitId, occupancyId },
  });

  // Rent Volatility check (sequential payments for same occupancy)
  // Since we query payments (ordered by month), we can check volatility within the occupancy groups
  const occupancyRentPaths = {};
  payments.forEach((p) => {
    if (!occupancyRentPaths[p.occupancyId]) {
      occupancyRentPaths[p.occupancyId] = [];
    }
    occupancyRentPaths[p.occupancyId].push(p);
  });

  let volatilitySignalsEmitted = 0;

  Object.keys(occupancyRentPaths).forEach((occId) => {
    const list = occupancyRentPaths[occId];
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1].amount;
      const curr = list[i].amount;
      if (prev > 0) {
        const pctDiff = Math.abs(curr - prev) / prev;
        if (pctDiff >= 0.15) {
          volatilitySignalsEmitted++;
          signals.push({
            type: "RENT_VOLATILITY_DETECTED",
            value: parseFloat((pctDiff * 100).toFixed(1)),
            unit: "percent",
            source: "Calculation",
            scope: { unitId, occupancyId: Number(occId) },
          });
        }
      }
    }
  });

  // Emit risks and recommendations
  if (overdueCount > 0) {
    risks.push({
      type: "OVERDUE_PATTERN",
      severity: "MEDIUM",
      message: `Detected ${overdueCount} payment(s) past their policy due date.`,
      source: "SignalCheck",
      scope: { unitId, occupancyId },
    });

    recommendations.push({
      type: "REVIEW_PENDING_OBLIGATIONS",
      message: "Suggest checking rent statement timelines and resolving pending receipts.",
      triggerSignal: "OVERDUE_PAYMENTS_COUNT",
      scope: { unitId, occupancyId },
    });
  }

  if (volatilitySignalsEmitted > 0) {
    risks.push({
      type: "RENT_AMOUNT_VOLATILITY",
      severity: "LOW",
      message: "Rent amount changed significantly between sequential statements.",
      source: "SignalCheck",
      scope: { unitId, occupancyId },
    });

    recommendations.push({
      type: "AUDIT_STATEMENT_CHANGES",
      message: "Verify correctness of manual rent amount alterations in statement logs.",
      triggerSignal: "RENT_VOLATILITY_DETECTED",
      scope: { unitId, occupancyId },
    });
  }

  return { facts, signals, risks, recommendations };
}

module.exports = { getPaymentMetrics, getPaymentDueDate };
