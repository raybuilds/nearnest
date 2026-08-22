const prisma = require("../../prismaClient");

/**
 * Constructs a deterministic identity key for deduplication.
 */
function constructEventKey(type, sourceEntity, sourceId, period = null) {
  if (period) {
    return `${type}:${sourceEntity}:${sourceId}:${period}`;
  }
  return `${type}:${sourceEntity}:${sourceId}`;
}

/**
 * Resolves recipient user IDs based on scoping and entities.
 */
async function resolveRecipients({ unitId, occupancyId, studentId, paymentId, agreementId, guestStayId, complaintId }) {
  const recipientIds = new Set();

  // 1. Resolve student and parent recipient from occupancy/student context
  let targetStudentId = studentId;

  if (occupancyId) {
    const occ = await prisma.occupancy.findUnique({
      where: { id: occupancyId },
      select: { studentId: true },
    });
    if (occ) targetStudentId = occ.studentId;
  } else if (paymentId) {
    const pay = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { occupancy: { select: { studentId: true } } },
    });
    if (pay?.occupancy) targetStudentId = pay.occupancy.studentId;
  } else if (agreementId) {
    const agg = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { occupancy: { select: { studentId: true } } },
    });
    if (agg?.occupancy) targetStudentId = agg.occupancy.studentId;
  } else if (guestStayId) {
    const guest = await prisma.guestStay.findUnique({
      where: { id: guestStayId },
      include: { occupancy: { select: { studentId: true } } },
    });
    if (guest?.occupancy) targetStudentId = guest.occupancy.studentId;
  } else if (complaintId) {
    const comp = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { studentId: true },
    });
    if (comp) targetStudentId = comp.studentId;
  }

  if (targetStudentId) {
    // Add student user
    const studentUser = await prisma.student.findUnique({
      where: { id: targetStudentId },
      select: { userId: true },
    });
    if (studentUser?.userId) {
      recipientIds.add(studentUser.userId);
    }

    // Add verified parents
    const parentLinks = await prisma.parentStudent.findMany({
      where: { studentId: targetStudentId, active: true, verified: true },
      include: { parent: { select: { userId: true } } },
    });
    parentLinks.forEach((link) => {
      if (link.parent?.userId) {
        recipientIds.add(link.parent.userId);
      }
    });
  }

  // 2. Resolve landlord recipient from unit context
  let targetUnitId = unitId;

  if (!targetUnitId && occupancyId) {
    const occ = await prisma.occupancy.findUnique({
      where: { id: occupancyId },
      select: { unitId: true },
    });
    if (occ) targetUnitId = occ.unitId;
  } else if (!targetUnitId && paymentId) {
    const pay = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { occupancy: { select: { unitId: true } } },
    });
    if (pay?.occupancy) targetUnitId = pay.occupancy.unitId;
  } else if (!targetUnitId && agreementId) {
    const agg = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { occupancy: { select: { unitId: true } } },
    });
    if (agg?.occupancy) targetUnitId = agg.occupancy.unitId;
  } else if (!targetUnitId && guestStayId) {
    const guest = await prisma.guestStay.findUnique({
      where: { id: guestStayId },
      include: { occupancy: { select: { unitId: true } } },
    });
    if (guest?.occupancy) targetUnitId = guest.occupancy.unitId;
  } else if (!targetUnitId && complaintId) {
    const comp = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { unitId: true },
    });
    if (comp) targetUnitId = comp.unitId;
  }

  if (targetUnitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      include: { landlord: { select: { userId: true } } },
    });
    if (unit?.landlord?.userId) {
      recipientIds.add(unit.landlord.userId);
    }
  }

  // 3. Resolve all admin recipients
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });
  admins.forEach((admin) => {
    recipientIds.add(admin.id);
  });

  // Verify that all resolved recipient IDs actually exist in the User table
  const validUserIds = [];
  for (const id of Array.from(recipientIds)) {
    const userExists = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (userExists) {
      validUserIds.push(id);
    }
  }

  return validUserIds;
}

/**
 * Creates a persistent alert inside the database.
 */
async function createAlert({
  recipientId,
  type,
  severity,
  sourceEntity,
  sourceId,
  period = null,
  title,
  message,
  metadata = {},
  unitId = null,
  occupancyId = null,
  paymentId = null,
  agreementId = null,
  guestStayId = null,
  complaintId = null,
}) {
  const eventKey = constructEventKey(type, sourceEntity, sourceId, period);

  try {
    const alert = await prisma.alert.create({
      data: {
        recipientId,
        eventKey,
        type,
        severity,
        status: "OPEN",
        unitId,
        occupancyId,
        paymentId,
        agreementId,
        guestStayId,
        complaintId,
        title,
        message,
        metadata,
      },
    });
    return alert;
  } catch (error) {
    // P2002 is Prisma's code for Unique Constraint Violation (Deduplication)
    if (error.code === "P2002") {
      // Fetch the existing alert to preserve state
      const existing = await prisma.alert.findUnique({
        where: {
          recipientId_eventKey: {
            recipientId,
            eventKey,
          },
        },
      });
      return existing;
    }
    // Handle Foreign Key Constraint violation (recipient user was deleted concurrently)
    if (error.code === "P2003") {
      console.warn(`[createAlert] Recipient user ${recipientId} does not exist or was deleted mid-flight. Skipping.`);
      return null;
    }
    throw error;
  }
}

/**
 * Transitions alert status safely.
 */
async function transitionAlertStatus(alertId, nextStatus, userId, userRole) {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
  });

  if (!alert) {
    throw new Error("Alert not found");
  }

  // Authorize recipient matching or admin override
  if (alert.recipientId !== userId && userRole !== "admin") {
    throw new Error("Forbidden: Unauthorized to mutate this alert");
  }

  const currentStatus = alert.status;
  const validTransitions = {
    OPEN: ["READ", "ACKNOWLEDGED", "DISMISSED", "EXPIRED"],
    READ: ["ACKNOWLEDGED", "DISMISSED", "EXPIRED"],
    ACKNOWLEDGED: ["RESOLVED", "DISMISSED"],
    RESOLVED: [],
    DISMISSED: [],
    EXPIRED: [],
  };

  if (!validTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }

  // Admin resolution restriction check
  if (nextStatus === "RESOLVED" && userRole !== "admin") {
    throw new Error("Forbidden: Only administrators can resolve alerts");
  }

  const updatedData = { status: nextStatus };
  if (nextStatus === "READ") {
    updatedData.readAt = new Date();
  } else if (nextStatus === "RESOLVED") {
    updatedData.resolvedAt = new Date();
  }

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: updatedData,
  });

  return updated;
}

module.exports = {
  constructEventKey,
  resolveRecipients,
  createAlert,
  transitionAlertStatus,
};
