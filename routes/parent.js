const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.get("/parent/dashboard", verifyToken, requireRole("parent"), async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { name: true } },
        students: {
          where: { active: true },
          include: {
            student: {
              include: {
                user: { select: { email: true } },
                institution: true,
                corridor: true,
                occupancies: {
                  where: { endDate: null },
                  include: {
                    unit: {
                      include: {
                        corridor: true,
                      },
                    },
                  },
                },
                occupants: {
                  where: { active: true },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ error: "Parent profile not found" });
    }

    const parentStudent = parent.students[0];
    if (!parentStudent) {
      return res.json({
        parent: {
          name: parent.user?.name || null,
          phoneNumber: parent.phoneNumber,
        },
        child: null,
        occupancy: null,
        complaints: [],
      });
    }

    const student = parentStudent.student;
    const activeOccupancy = student.occupancies[0] || null;
    const activeOccupant = student.occupants[0] || null;

    let complaints = [];
    let guestStays = [];
    if (activeOccupancy) {
      const [compData, stayData] = await Promise.all([
        prisma.complaint.findMany({
          where: {
            studentId: student.id,
            unitId: activeOccupancy.unitId,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.guestStay.findMany({
          where: {
            occupancyId: activeOccupancy.id,
            active: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      complaints = compData;
      guestStays = stayData;
    }

    return res.json({
      parent: {
        name: parent.user?.name || null,
        phoneNumber: parent.phoneNumber,
      },
      child: {
        id: student.id,
        name: student.name,
        email: student.user?.email || null,
        intake: student.intake,
        corridor: student.corridor ? { id: student.corridor.id, name: student.corridor.name } : null,
        institution: student.institution ? { id: student.institution.id, name: student.institution.name } : null,
      },
      occupancy: activeOccupancy ? {
        id: activeOccupancy.id,
        startDate: activeOccupancy.startDate,
        endDate: activeOccupancy.endDate,
        unit: {
          id: activeOccupancy.unit.id,
          status: activeOccupancy.unit.status,
          trustScore: activeOccupancy.unit.trustScore,
          ac: activeOccupancy.unit.ac,
          capacity: activeOccupancy.unit.capacity,
          corridor: activeOccupancy.unit.corridor ? { id: activeOccupancy.unit.corridor.id, name: activeOccupancy.unit.corridor.name } : null,
        },
        occupant: activeOccupant ? {
          publicId: activeOccupant.publicId,
          roomNumber: activeOccupant.roomNumber,
          occupantIndex: activeOccupant.occupantIndex,
        } : null,
      } : null,
      complaints: complaints.map((c) => ({
        id: c.id,
        severity: c.severity,
        message: c.message,
        resolved: c.resolved,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        slaDeadline: c.slaDeadline,
        incidentType: c.incidentType,
      })),
      guestStays: guestStays.map((g) => ({
        id: g.id,
        guestName: g.guestName,
        startDate: g.startDate,
        endDate: g.endDate,
        active: g.active,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
