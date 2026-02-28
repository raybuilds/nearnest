const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken } = require("../middlewares/auth");

const router = express.Router();

function getLateResolvedCount(complaints) {
  return complaints.filter((item) => {
    if (!item.resolved || !item.resolvedAt || !item.slaDeadline) return false;
    return new Date(item.resolvedAt) > new Date(item.slaDeadline);
  }).length;
}

function getAvgResolutionHours(complaints) {
  const values = complaints
    .filter((item) => item.resolved && item.resolvedAt && item.createdAt)
    .map((item) => {
      const created = new Date(item.createdAt);
      const resolved = new Date(item.resolvedAt);
      if (Number.isNaN(created.getTime()) || Number.isNaN(resolved.getTime())) return null;
      return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
    })
    .filter((value) => value !== null);

  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { userId: user.id },
        include: {
          corridor: { select: { id: true, name: true } },
          institution: { select: { id: true, name: true } },
          vdpEntries: {
            orderBy: { joinedAt: "desc" },
            select: {
              id: true,
              corridorId: true,
              intake: true,
              verified: true,
              status: true,
              joinedAt: true,
            },
          },
        },
      });

      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const [currentOccupancy, occupancyHistory, complaints, shortlistCount] = await Promise.all([
        prisma.occupancy.findFirst({
          where: { studentId: student.id, endDate: null },
          include: {
            unit: {
              select: {
                id: true,
                corridor: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
        }),
        prisma.occupancy.findMany({
          where: { studentId: student.id },
          include: {
            unit: {
              select: {
                id: true,
                corridor: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { startDate: "desc" },
        }),
        prisma.complaint.findMany({
          where: { studentId: student.id },
          select: {
            id: true,
            unitId: true,
            severity: true,
            resolved: true,
            createdAt: true,
            resolvedAt: true,
            slaDeadline: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.shortlist.count({ where: { studentId: student.id } }),
      ]);

      const latestVdp = student.vdpEntries[0] || null;
      const resolvedComplaints = complaints.filter((item) => item.resolved);
      const profileStatus = currentOccupancy
        ? "active"
        : shortlistCount > 0
          ? "shortlisted"
          : latestVdp?.verified
            ? "verified"
            : "registered";

      return res.json({
        role: "student",
        identity: {
          name: student.name,
          studentId: student.id,
          institution: student.institution ? { id: student.institution.id, name: student.institution.name } : null,
          intake: student.intake,
          corridor: student.corridor ? { id: student.corridor.id, name: student.corridor.name } : null,
          joinedDate: user.createdAt,
          vdp: latestVdp
            ? {
                status: latestVdp.status,
                verified: latestVdp.verified,
                joinedAt: latestVdp.joinedAt,
              }
            : null,
          status: profileStatus,
        },
        occupancy: {
          currentUnit: currentOccupancy
            ? {
                unitId: currentOccupancy.unitId,
                checkInDate: currentOccupancy.startDate,
                corridor: currentOccupancy.unit?.corridor || null,
              }
            : null,
          history: occupancyHistory.map((item) => ({
            occupancyId: item.id,
            unitId: item.unitId,
            startDate: item.startDate,
            endDate: item.endDate,
            corridor: item.unit?.corridor || null,
          })),
        },
        complaintSummary: {
          totalSubmitted: complaints.length,
          openComplaints: complaints.filter((item) => !item.resolved).length,
          avgResolutionHours: getAvgResolutionHours(resolvedComplaints),
          latest: complaints.slice(0, 5),
        },
      });
    }

    if (user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!landlord) {
        return res.status(403).json({ error: "Landlord profile not found" });
      }

      const units = await prisma.unit.findMany({
        where: { landlordId: landlord.id },
        select: {
          id: true,
          status: true,
          trustScore: true,
          auditRequired: true,
          corridor: { select: { id: true, name: true } },
          complaints: {
            select: {
              id: true,
              resolved: true,
              createdAt: true,
              resolvedAt: true,
              slaDeadline: true,
            },
          },
        },
      });

      const unitIds = units.map((item) => item.id);
      const complaints = await prisma.complaint.findMany({
        where: { unitId: { in: unitIds.length > 0 ? unitIds : [-1] } },
        select: {
          id: true,
          resolved: true,
          createdAt: true,
          resolvedAt: true,
          slaDeadline: true,
        },
      });

      const distinctCorridors = Array.from(
        new Map(
          units
            .filter((item) => item.corridor)
            .map((item) => [item.corridor.id, { id: item.corridor.id, name: item.corridor.name }])
        ).values()
      );

      const resolvedComplaints = complaints.filter((item) => item.resolved);
      const lateResolvedCount = getLateResolvedCount(complaints);
      const slaCompliance =
        resolvedComplaints.length === 0
          ? null
          : Number((((resolvedComplaints.length - lateResolvedCount) / resolvedComplaints.length) * 100).toFixed(2));
      const avgTrust =
        units.length === 0 ? null : Number((units.reduce((sum, item) => sum + Number(item.trustScore || 0), 0) / units.length).toFixed(2));

      return res.json({
        role: "landlord",
        identity: {
          name: user.name,
          landlordId: landlord.id,
          corridorsActiveIn: distinctCorridors,
          joinedDate: user.createdAt,
        },
        portfolioSummary: {
          totalUnits: units.length,
          approvedUnits: units.filter((item) => item.status === "approved").length,
          suspendedUnits: units.filter((item) => item.status === "suspended").length,
          avgTrustAcrossUnits: avgTrust,
          slaCompliance,
        },
        riskSnapshot: {
          unitsAtAuditRisk: units.filter((item) => item.auditRequired || Number(item.trustScore) < 60).length,
          activeComplaints: complaints.filter((item) => !item.resolved).length,
        },
      });
    }

    if (user.role === "admin") {
      const [corridors, totalUnits, totalAudits, activeSuspensions, complaintsLast30Days] = await Promise.all([
        prisma.corridor.findMany({
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        }),
        prisma.unit.count(),
        prisma.auditLog.count(),
        prisma.unit.count({ where: { status: "suspended" } }),
        prisma.complaint.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      return res.json({
        role: "admin",
        identity: {
          name: user.name,
          adminId: user.id,
          joinedDate: user.createdAt,
        },
        governanceScope: {
          assignedCorridors: corridors,
          totalUnitsGoverned: totalUnits,
          totalAuditsTriggered: totalAudits,
          activeSuspensions,
          complaintDensityLast30Days: complaintsLast30Days,
        },
      });
    }

    return res.status(403).json({ error: "Unsupported role" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
