const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.post("/occupancy/check-in", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const { unitId, studentId } = req.body;
    if (!unitId || !studentId) {
      return res.status(400).json({ error: "unitId and studentId are required" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: Number(unitId) },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }

    const student = await prisma.student.findUnique({
      where: { id: Number(studentId) },
    });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const existingActiveForStudent = await prisma.occupancy.findFirst({
      where: {
        studentId: Number(studentId),
        endDate: null,
      },
    });
    if (existingActiveForStudent) {
      return res.status(400).json({ error: "Student is already checked into a unit" });
    }

    const activeOccupancyCount = await prisma.occupancy.count({
      where: {
        unitId: Number(unitId),
        endDate: null,
      },
    });
    if (activeOccupancyCount >= unit.capacity) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            unitId: Number(unitId),
            triggerType: "capacity_violation",
            reason: "Capacity breach attempt: landlord tried to check in beyond approved unit capacity",
          },
        });

        await tx.unit.update({
          where: { id: Number(unitId) },
          data: {
            structuralApproved: false,
            auditRequired: true,
            ...(unit.status === "archived" ? {} : { status: "suspended" }),
          },
        });
      });
      return res.status(400).json({ error: "Unit capacity reached" });
    }

    const occupancy = await prisma.occupancy.create({
      data: {
        unitId: Number(unitId),
        studentId: Number(studentId),
      },
    });

    return res.status(201).json(occupancy);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/occupancy/:id/check-out", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const occupancyId = Number(req.params.id);
    if (Number.isNaN(occupancyId)) {
      return res.status(400).json({ error: "occupancy id must be a number" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const occupancy = await prisma.occupancy.findUnique({
      where: { id: occupancyId },
      include: { unit: true },
    });
    if (!occupancy) {
      return res.status(404).json({ error: "Occupancy not found" });
    }
    if (occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }
    if (occupancy.endDate) {
      return res.status(400).json({ error: "Occupancy already checked out" });
    }

    const updated = await prisma.occupancy.update({
      where: { id: occupancyId },
      data: { endDate: new Date() },
    });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
