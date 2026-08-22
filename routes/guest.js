const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

// 1. Guest Check-In (Student only)
router.post("/guest/check-in", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const { guestName } = req.body;
    if (!guestName) {
      return res.status(400).json({ error: "guestName is required" });
    }

    // Resolve the active occupancy strictly from the student's own ID
    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    const activeOccupancy = await prisma.occupancy.findFirst({
      where: {
        studentId: student.id,
        endDate: null,
      },
    });

    if (!activeOccupancy) {
      return res.status(400).json({ error: "No active occupancy found for student" });
    }

    const guestStay = await prisma.guestStay.create({
      data: {
        guestName: String(guestName).trim(),
        occupancyId: activeOccupancy.id,
        active: true,
      },
    });

    return res.status(201).json(guestStay);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 2. Guest Check-Out (Student only)
router.patch("/guest/:id/check-out", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const guestStayId = Number(req.params.id);
    if (Number.isNaN(guestStayId)) {
      return res.status(400).json({ error: "guestStayId must be a number" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    const guestStay = await prisma.guestStay.findUnique({
      where: { id: guestStayId },
      include: { occupancy: true },
    });

    if (!guestStay) {
      return res.status(404).json({ error: "Guest stay not found" });
    }

    // Verify ownership: that the occupancy belongs to the student
    if (guestStay.occupancy.studentId !== student.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this occupancy stay" });
    }

    // Idempotency: if already checked out, just return it
    if (!guestStay.active || guestStay.endDate) {
      return res.json(guestStay);
    }

    const updated = await prisma.guestStay.update({
      where: { id: guestStayId },
      data: {
        active: false,
        endDate: new Date(),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 3. Get Student Stays (Student only)
router.get("/guest/stays", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    const stays = await prisma.guestStay.findMany({
      where: {
        occupancy: {
          studentId: student.id,
        },
      },
      include: {
        occupancy: {
          include: {
            unit: {
              select: { id: true, status: true, trustScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(stays);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 4. Get Landlord Unit Guest Stays (Landlord only)
router.get("/landlord/unit/:id/guest-stays", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
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

    // Ownership validation
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const stays = await prisma.guestStay.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    return res.json(stays);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
