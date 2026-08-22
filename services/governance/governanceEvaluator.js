const prisma = require("../../prismaClient");
const { createAlert, resolveRecipients } = require("../alerts/alertManager");
const { getPaymentDueDate } = require("../analytics/paymentAnalytics");

/**
 * Runs a full database check to discover and persist new alerts.
 */
async function evaluateGovernanceRules() {
  const generatedAlerts = [];

  // 1. COMPLIANCE EXPIRATION EVALUATION
  const compliances = await prisma.unitCompliance.findMany({
    where: {
      status: "APPROVED",
      expiryDate: { not: null },
    },
  });

  for (const comp of compliances) {
    const endTimestamp = new Date(comp.expiryDate).getTime();
    const diffMs = endTimestamp - Date.now();
    const daysRemaining = diffMs / (1000 * 3600 * 24);

    if (daysRemaining <= 0) {
      // EXPIRED
      const recipients = await resolveRecipients({ unitId: comp.unitId });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "COMPLIANCE_EXPIRED",
          severity: "HIGH",
          sourceEntity: "compliance",
          sourceId: comp.id,
          title: "Compliance Document Expired",
          message: `The ${comp.docType} compliance document has expired.`,
          unitId: comp.unitId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    } else if (daysRemaining <= 30) {
      // EXPIRING SOON
      const recipients = await resolveRecipients({ unitId: comp.unitId });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "COMPLIANCE_EXPIRING",
          severity: "MEDIUM",
          sourceEntity: "compliance",
          sourceId: comp.id,
          title: "Compliance Document Expiring",
          message: `The ${comp.docType} compliance document is expiring in ${Math.ceil(daysRemaining)} days.`,
          unitId: comp.unitId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    }
  }

  // 2. AGREEMENT EXPIRATION EVALUATION
  const agreements = await prisma.agreement.findMany({
    where: {
      status: "ACTIVE",
    },
  });

  for (const agg of agreements) {
    const endTimestamp = new Date(agg.endDate).getTime();
    const diffMs = endTimestamp - Date.now();
    const daysRemaining = diffMs / (1000 * 3600 * 24);

    if (daysRemaining <= 0) {
      // EXPIRED
      const recipients = await resolveRecipients({ agreementId: agg.id });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "AGREEMENT_EXPIRED",
          severity: "HIGH",
          sourceEntity: "agreement",
          sourceId: agg.id,
          title: "Rental Agreement Expired",
          message: `The rental agreement version ${agg.version} has expired.`,
          agreementId: agg.id,
          occupancyId: agg.occupancyId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    } else if (daysRemaining <= 30) {
      // EXPIRING SOON
      const recipients = await resolveRecipients({ agreementId: agg.id });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "AGREEMENT_EXPIRING",
          severity: "MEDIUM",
          sourceEntity: "agreement",
          sourceId: agg.id,
          title: "Rental Agreement Expiring Soon",
          message: `The rental agreement is expiring in ${Math.ceil(daysRemaining)} days.`,
          agreementId: agg.id,
          occupancyId: agg.occupancyId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    }
  }

  // 3. PAYMENT OVERDUE EVALUATION
  const payments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
    },
  });

  for (const pay of payments) {
    const dueDate = getPaymentDueDate(pay.month);
    // Only flag if due date is in the past, and month is not in the future
    if (dueDate && Date.now() > dueDate.getTime()) {
      const recipients = await resolveRecipients({ paymentId: pay.id });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "PAYMENT_OVERDUE",
          severity: "HIGH",
          sourceEntity: "payment",
          sourceId: pay.id,
          period: pay.month, // Include monthly period to allow future month alert deduplication
          title: "Payment Overdue",
          message: `The rent payment of ₹${pay.amount} for ${pay.month} is overdue.`,
          paymentId: pay.id,
          occupancyId: pay.occupancyId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    }
  }

  // 4. CAPACITY PRESSURE EVALUATION
  const units = await prisma.unit.findMany({
    include: {
      occupancies: {
        where: { endDate: null },
      },
    },
  });

  for (const u of units) {
    const activeCount = u.occupancies.length;
    const utilization = u.capacity > 0 ? activeCount / u.capacity : 0;

    if (utilization >= 0.95) {
      const recipients = await resolveRecipients({ unitId: u.id });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "CAPACITY_PRESSURE",
          severity: "MEDIUM",
          sourceEntity: "unit",
          sourceId: u.id,
          title: "Capacity Pressure High",
          message: `Unit #${u.id} has reached ${(utilization * 100).toFixed(0)}% capacity.`,
          unitId: u.id,
        });
        if (alert) generatedAlerts.push(alert);
      }
    }
  }

  // 5. EXTENDED GUEST STAY EVALUATION
  const guestStays = await prisma.guestStay.findMany({
    where: { active: true },
  });

  for (const guest of guestStays) {
    const durationMs = Date.now() - new Date(guest.startDate).getTime();
    const durationHours = durationMs / (1000 * 3600);

    if (durationHours >= 72) {
      const recipients = await resolveRecipients({ guestStayId: guest.id });
      for (const recId of recipients) {
        const alert = await createAlert({
          recipientId: recId,
          type: "GUEST_STAY_EXTENDED",
          severity: "LOW",
          sourceEntity: "guestStay",
          sourceId: guest.id,
          title: "Extended Guest Stay Pattern Detected",
          message: `Guest "${guest.guestName}" has stayed longer than 72 hours.`,
          guestStayId: guest.id,
          occupancyId: guest.occupancyId,
        });
        if (alert) generatedAlerts.push(alert);
      }
    }
  }

  return generatedAlerts;
}

module.exports = { evaluateGovernanceRules };
