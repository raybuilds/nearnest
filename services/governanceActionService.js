const prisma = require("../prismaClient");

async function ensureAuditForUnit(unitId, options = {}) {
  const resolvedUnitId = Number(unitId);
  if (Number.isNaN(resolvedUnitId)) {
    return null;
  }

  const triggerType = String(options.triggerType || "manual").trim();
  const reason = String(options.reason || "Governance review requested").trim();

  const unit = await prisma.unit.findUnique({
    where: { id: resolvedUnitId },
    select: {
      id: true,
      status: true,
      auditRequired: true,
    },
  });
  if (!unit) {
    return null;
  }

  const existingOpenAudit = await prisma.auditLog.findFirst({
    where: {
      unitId: resolvedUnitId,
      resolved: false,
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (!existingOpenAudit && !unit.auditRequired) {
      await tx.auditLog.create({
        data: {
          unitId: resolvedUnitId,
          triggerType,
          reason,
        },
      });
    }

    await tx.unit.update({
      where: { id: resolvedUnitId },
      data: {
        auditRequired: true,
        ...(unit.status === "archived" ? {} : { status: "suspended" }),
      },
    });
  });

  return {
    unitId: resolvedUnitId,
    previousStatus: unit.status,
    nextStatus: unit.status === "archived" ? "archived" : "suspended",
    auditRequired: true,
  };
}

module.exports = {
  ensureAuditForUnit,
};
