const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Helper to seed pending obligations
async function seedPendingObligations(occupancy, tx) {
  if (!occupancy || occupancy.endDate) return;
  const start = new Date(occupancy.startDate);
  const end = new Date(); // current system date

  const startYear = start.getFullYear();
  const startMonth = start.getMonth(); // 0-indexed
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  const monthsToSeed = [];
  let currYear = startYear;
  let currMonth = startMonth;

  while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
    const monthStr = `${currYear}-${String(currMonth + 1).padStart(2, "0")}`;
    monthsToSeed.push(monthStr);
    currMonth++;
    if (currMonth > 11) {
      currMonth = 0;
      currYear++;
    }
  }

  for (const m of monthsToSeed) {
    try {
      await tx.payment.upsert({
        where: {
          occupancyId_month: {
            occupancyId: occupancy.id,
            month: m,
          },
        },
        update: {},
        create: {
          occupancyId: occupancy.id,
          month: m,
          amount: occupancy.unit.rent,
          status: "PENDING",
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        // Handle concurrent writes gracefully
        continue;
      }
      throw err;
    }
  }
}

// 1. GET /payment/ledger
router.get("/payment/ledger", verifyToken, async (req, res) => {
  try {
    let studentIds = [];
    if (req.user.role === "student") {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (!student) return res.status(404).json({ error: "Student not found" });
      studentIds.push(student.id);
    } else if (req.user.role === "parent") {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { students: { where: { active: true } } },
      });
      if (!parent) return res.status(404).json({ error: "Parent not found" });
      studentIds = parent.students.map((ps) => ps.studentId);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Fetch all occupancies for these studentIds
    const occupancies = await prisma.occupancy.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        unit: true,
        payments: {
          orderBy: { month: "asc" },
        },
      },
    });

    // Seeding active occupancies
    const activeOccupancies = occupancies.filter((occ) => !occ.endDate);
    for (const occ of activeOccupancies) {
      await prisma.$transaction(async (tx) => {
        await seedPendingObligations(occ, tx);
      });
    }

    // Re-fetch occupancies to return seeded payments
    const finalOccupancies = await prisma.occupancy.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        unit: {
          select: { id: true, status: true, trustScore: true, rent: true },
        },
        payments: {
          orderBy: { month: "asc" },
        },
      },
    });

    return res.json(
      finalOccupancies.map((occ) => ({
        occupancy: {
          id: occ.id,
          startDate: occ.startDate,
          endDate: occ.endDate,
          unit: occ.unit,
        },
        payments: occ.payments,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 2. POST /payment/submit
router.post("/payment/submit", verifyToken, async (req, res) => {
  try {
    const { month, receiptRef, studentId } = req.body;
    if (!month || !receiptRef) {
      return res.status(400).json({ error: "month and receiptRef are required" });
    }

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ error: "Invalid month format. Must be YYYY-MM" });
    }

    const [yearStr, monthStr] = month.split("-");
    const current = new Date();
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;

    const requestedYear = parseInt(yearStr, 10);
    const requestedMonth = parseInt(monthStr, 10);

    if (requestedYear > currentYear || (requestedYear === currentYear && requestedMonth > currentMonth)) {
      return res.status(400).json({ error: "Cannot submit payment for future months" });
    }

    let targetStudentId;
    if (req.user.role === "student") {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (!student) return res.status(404).json({ error: "Student not found" });
      targetStudentId = student.id;
    } else if (req.user.role === "parent") {
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for parent submissions" });
      }
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: {
          students: {
            where: {
              studentId: Number(studentId),
              active: true,
            },
          },
        },
      });
      if (!parent || parent.students.length === 0) {
        return res.status(403).json({ error: "Forbidden: Not linked to this student" });
      }
      targetStudentId = Number(studentId);
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const activeOccupancy = await prisma.occupancy.findFirst({
      where: {
        studentId: targetStudentId,
        endDate: null,
      },
      include: { unit: true },
    });

    if (!activeOccupancy) {
      return res.status(400).json({ error: "No active occupancy found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      await seedPendingObligations(activeOccupancy, tx);

      const payment = await tx.payment.findUnique({
        where: {
          occupancyId_month: {
            occupancyId: activeOccupancy.id,
            month,
          },
        },
      });

      if (!payment) {
        throw new Error("Payment obligation not generated");
      }

      if (payment.status === "PAID" || payment.status === "VERIFIED") {
        throw new Error("Payment already paid or verified");
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          receiptRef: String(receiptRef).trim(),
        },
      });

      await tx.paymentAudit.create({
        data: {
          paymentId: payment.id,
          actorId: req.user.id,
          action: "STATUS_CHANGE",
          changes: {
            status: { old: payment.status, new: "PAID" },
            receiptRef: { old: payment.receiptRef, new: String(receiptRef).trim() },
          },
          reason: "User payment submission",
        },
      });

      return updated;
    });

    return res.json(result);
  } catch (error) {
    if (error.message === "Payment already paid or verified" || error.message === "Payment obligation not generated") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 3. PATCH /payment/:id/verify
router.patch("/payment/:id/verify", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        occupancy: {
          include: { unit: true },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!current) throw new Error("Payment not found");

      if (current.status === "VERIFIED") {
        return current;
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "VERIFIED" },
      });

      await tx.paymentAudit.create({
        data: {
          paymentId,
          actorId: req.user.id,
          action: "STATUS_CHANGE",
          changes: {
            status: { old: current.status, new: "VERIFIED" },
          },
          reason: "Landlord verification",
        },
      });

      return updated;
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 4. PATCH /admin/payment/:id/override
router.patch("/admin/payment/:id/override", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }

    const { status, amount, receiptRef, reason } = req.body;
    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({ error: "reason is required for admin overrides" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!current) throw new Error("Payment not found");

      const updateData = {};
      const changes = {};

      if (status !== undefined) {
        updateData.status = status;
        changes.status = { old: current.status, new: status };
      }
      if (amount !== undefined) {
        updateData.amount = Number(amount);
        changes.amount = { old: current.amount, new: Number(amount) };
      }
      if (receiptRef !== undefined) {
        updateData.receiptRef = receiptRef;
        changes.receiptRef = { old: current.receiptRef, new: receiptRef };
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error("No updates provided");
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: updateData,
      });

      await tx.paymentAudit.create({
        data: {
          paymentId,
          actorId: req.user.id,
          action: "ADMIN_OVERRIDE",
          changes,
          reason: String(reason).trim(),
        },
      });

      return updated;
    });

    return res.json(result);
  } catch (error) {
    if (error.message === "Payment not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "No updates provided") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 5. GET /landlord/unit/:id/payments
router.get("/landlord/unit/:id/payments", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "Invalid unit ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const payments = await prisma.payment.findMany({
      where: {
        occupancy: {
          unitId: unitId,
        },
      },
      include: {
        occupancy: {
          include: {
            student: {
              select: { id: true, name: true, intake: true },
            },
          },
        },
      },
      orderBy: { month: "desc" },
    });

    return res.json(payments);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 6. GET /admin/payments
router.get("/admin/payments", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        occupancy: {
          include: {
            student: { select: { id: true, name: true } },
            unit: { select: { id: true, landlordId: true } },
          },
        },
        audits: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(payments);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
