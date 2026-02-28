const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");
const { generateOccupantId } = require("../services/occupantIdService");

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

    const parsedUnitId = Number(unitId);
    const parsedStudentId = Number(studentId);
    if (Number.isNaN(parsedUnitId) || Number.isNaN(parsedStudentId)) {
      return res.status(400).json({ error: "unitId and studentId must be numbers" });
    }
    const unit = await prisma.unit.findUnique({
      where: { id: parsedUnitId },
      include: {
        corridor: {
          select: { id: true, cityCode: true },
        },
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }

    const student = await prisma.student.findUnique({
      where: { id: parsedStudentId },
    });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const existingActiveForStudent = await prisma.occupancy.findFirst({
      where: {
        studentId: parsedStudentId,
        endDate: null,
      },
    });
    if (existingActiveForStudent) {
      return res.status(400).json({ error: "Student is already checked into a unit" });
    }

    const activeOccupancyCount = await prisma.occupancy.count({
      where: {
        unitId: parsedUnitId,
        endDate: null,
      },
    });
    if (activeOccupancyCount >= unit.capacity) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            unitId: parsedUnitId,
            triggerType: "capacity_violation",
            reason: "Capacity breach attempt: landlord tried to check in beyond approved unit capacity",
          },
        });

        await tx.unit.update({
          where: { id: parsedUnitId },
          data: {
            structuralApproved: false,
            auditRequired: true,
            ...(unit.status === "archived" ? {} : { status: "suspended" }),
          },
        });
      });
      return res.status(400).json({ error: "Unit capacity reached" });
    }

    const cityCode = Number(unit.corridor?.cityCode || 0);
    const corridorCode = Number(unit.corridorId);
    const hostelCode = Number(unit.id);
    const roomNumber = Number(unit.id);
    if (cityCode < 0 || cityCode > 99 || corridorCode < 0 || corridorCode > 999 || hostelCode < 0 || hostelCode > 999 || roomNumber < 0 || roomNumber > 999) {
      return res.status(400).json({ error: "Unit/corridor mapping exceeds occupant id segment limits" });
    }
    let occupantIndex = activeOccupancyCount + 1;
    let publicId = null;

    while (occupantIndex <= 9) {
      const candidate = generateOccupantId({
        cityCode,
        corridorCode,
        hostelCode,
        roomNumber,
        occupantIndex,
      });
      const existing = await prisma.occupant.findUnique({
        where: { publicId: candidate },
        select: { id: true },
      });
      if (!existing) {
        publicId = candidate;
        break;
      }
      occupantIndex += 1;
    }

    if (!publicId) {
      return res.status(400).json({ error: "No occupant slot available for this room mapping" });
    }

    const { occupancy, occupant } = await prisma.$transaction(async (tx) => {
      const createdOccupancy = await tx.occupancy.create({
        data: {
          unitId: parsedUnitId,
          studentId: parsedStudentId,
        },
      });

      const createdOccupant = await tx.occupant.create({
        data: {
          publicId,
          cityCode,
          corridorCode,
          hostelCode,
          roomNumber,
          occupantIndex,
          studentId: parsedStudentId,
          unitId: parsedUnitId,
          active: true,
        },
      });

      return { occupancy: createdOccupancy, occupant: createdOccupant };
    });
    return res.status(201).json({
      ...occupancy,
      occupant: {
        id: occupant.id,
        publicId: occupant.publicId,
      },
    });
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
    await prisma.occupant.updateMany({
      where: {
        studentId: occupancy.studentId,
        unitId: occupancy.unitId,
        active: true,
      },
      data: { active: false },
    });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
