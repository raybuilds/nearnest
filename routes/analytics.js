const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");
const { getUnitOperationalMetrics } = require("../services/analytics/unitAnalytics");
const { getGlobalDashboardAnalytics } = require("../services/analytics/dawnAnalytics");

const router = express.Router();

// 1. GET /api/student/analytics - Student own metrics only
router.get("/api/student/analytics", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
      include: {
        occupancies: {
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    });

    if (!student || student.occupancies.length === 0) {
      return res.json({ facts: [], signals: [], risks: [], recommendations: [] });
    }

    const activeOccupancy = student.occupancies[0];
    const metrics = await getUnitOperationalMetrics(activeOccupancy.unitId, activeOccupancy.id);
    return res.json(metrics);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load student analytics" });
  }
});

// 2. GET /api/parent/analytics - Parent child-scoped metrics only
router.get("/api/parent/analytics", verifyToken, requireRole("parent"), async (req, res) => {
  try {
    const parent = await prisma.parent.findFirst({
      where: { userId: req.user.id },
    });

    if (!parent) {
      return res.status(403).json({ error: "Parent profile not found" });
    }

    const childLinks = await prisma.parentStudent.findMany({
      where: { parentId: parent.id, active: true, verified: true },
      include: {
        student: {
          include: {
            occupancies: {
              orderBy: { startDate: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const childrenAnalytics = [];

    for (const link of childLinks) {
      const activeOcc = link.student.occupancies[0];
      if (activeOcc) {
        const metrics = await getUnitOperationalMetrics(activeOcc.unitId, activeOcc.id);
        childrenAnalytics.push({
          childName: link.student.name,
          studentId: link.student.id,
          unitId: activeOcc.unitId,
          metrics,
        });
      }
    }

    return res.json(childrenAnalytics);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load parent child analytics" });
  }
});

// 3. GET /api/landlord/unit/:id/analytics - Landlord owned unit metrics only
router.get("/api/landlord/unit/:id/analytics", verifyToken, requireRole("landlord"), async (req, res) => {
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

    const metrics = await getUnitOperationalMetrics(unitId);
    return res.json(metrics);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load landlord unit analytics" });
  }
});

// 4. GET /api/admin/analytics - Admin global system oversight metrics
router.get("/api/admin/analytics", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const metrics = await getGlobalDashboardAnalytics();
    return res.json(metrics);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load global admin analytics" });
  }
});

module.exports = router;
