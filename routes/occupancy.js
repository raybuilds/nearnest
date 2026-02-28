const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");
const { generateOccupantId } = require("../services/occupantIdService");

const router = express.Router();

function createCheckInError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

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

    const cityCode = Number(unit.corridor?.cityCode || 0);
    const corridorCode = Number(unit.corridorId);
    const hostelCode = Number(unit.id);
    const roomNumber = Number(unit.id);
    if (cityCode < 0 || cityCode > 99 || corridorCode < 0 || corridorCode > 999 || hostelCode < 0 || hostelCode > 999 || roomNumber < 0 || roomNumber > 999) {
      return res.status(400).json({ error: "Unit/corridor mapping exceeds occupant id segment limits" });
    }
    const maxEncodableSlots = 9;
    const maxAllowedCapacity = Math.min(unit.capacity, maxEncodableSlots);

    if (maxAllowedCapacity <= 0) {
      return res.status(400).json({ error: "Unit capacity is not configured for occupancy" });
    }

    const runTransactionalCheckIn = async () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${parsedUnitId} FOR UPDATE`;

        const activeCount = await tx.occupancy.count({
          where: {
            unitId: parsedUnitId,
            endDate: null,
          },
        });
        if (activeCount >= maxAllowedCapacity) {
          throw createCheckInError("CAPACITY_REACHED", "Unit capacity reached");
        }

        const activeForStudent = await tx.occupancy.findFirst({
          where: {
            studentId: parsedStudentId,
            endDate: null,
          },
          select: { id: true },
        });
        if (activeForStudent) {
          throw createCheckInError("STUDENT_ALREADY_ACTIVE", "Student is already checked into a unit");
        }

        const existing = await tx.occupant.findMany({
          where: {
            unitId: parsedUnitId,
            roomNumber,
            active: true,
          },
          select: { occupantIndex: true },
        });

        const usedIndices = new Set(existing.map((item) => item.occupantIndex));
        let occupantIndex = 1;
        while (usedIndices.has(occupantIndex) && occupantIndex <= maxAllowedCapacity) {
          occupantIndex += 1;
        }
        if (occupantIndex > maxAllowedCapacity || occupantIndex > maxEncodableSlots) {
          throw createCheckInError("NO_SLOT_AVAILABLE", "No occupant slot available for this room mapping");
        }

        const publicId = generateOccupantId({
          cityCode,
          corridorCode,
          hostelCode,
          roomNumber,
          occupantIndex,
        });

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

    let attempt = 0;
    const maxRetries = 3;
    let result = null;
    while (attempt < maxRetries) {
      try {
        result = await runTransactionalCheckIn();
        break;
      } catch (error) {
        if (error?.code === "P2002") {
          attempt += 1;
          if (attempt >= maxRetries) {
            throw createCheckInError("CHECKIN_CONFLICT", "Check-in conflict. Please retry.");
          }
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw createCheckInError("CHECKIN_CONFLICT", "Check-in conflict. Please retry.");
    }

    const { occupancy, occupant } = result;
    return res.status(201).json({
      ...occupancy,
      occupant: {
        id: occupant.id,
        publicId: occupant.publicId,
      },
    });
  } catch (error) {
    if (error?.code === "STUDENT_ALREADY_ACTIVE") {
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "CAPACITY_REACHED") {
      const { unitId } = req.body;
      const parsedUnitId = Number(unitId);
      if (!Number.isNaN(parsedUnitId)) {
        const currentUnit = await prisma.unit.findUnique({
          where: { id: parsedUnitId },
          select: { id: true, status: true },
        });
        if (currentUnit) {
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
                ...(currentUnit.status === "archived" ? {} : { status: "suspended" }),
              },
            });
          });
        }
      }
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "NO_SLOT_AVAILABLE" || error?.code === "CHECKIN_CONFLICT") {
      return res.status(409).json({ error: error.message });
    }
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
