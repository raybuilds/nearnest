const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken } = require("../middlewares/auth");

const router = express.Router();
const HEALTH_WINDOW_DAYS = 30;

function formatOccupantPublicId(publicId) {
  if (!publicId || !/^\d{12}$/.test(publicId)) {
    return publicId || null;
  }
  return `NN-${publicId.slice(0, 2)}-${publicId.slice(2, 5)}-${publicId.slice(5, 8)}-${publicId.slice(8, 11)}-${publicId.slice(11, 12)}`;
}

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

function getTrustBand(trustScore) {
  if (Number(trustScore) < 50) return "hidden";
  if (Number(trustScore) < 80) return "standard";
  return "priority";
}

function getWindowCutoff(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isSlaBreach(complaint) {
  const now = new Date();
  if (!complaint.slaDeadline) return false;
  const deadline = new Date(complaint.slaDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  if (!complaint.resolved) {
    return now > deadline;
  }
  if (!complaint.resolvedAt) return false;
  const resolvedAt = new Date(complaint.resolvedAt);
  if (Number.isNaN(resolvedAt.getTime())) return false;
  return resolvedAt > deadline;
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

      const [currentOccupancy, occupancyHistory, complaints, shortlistCount, occupants] = await Promise.all([
        prisma.occupancy.findFirst({
          where: { studentId: student.id, endDate: null },
          include: {
            unit: {
              include: {
                corridor: { select: { id: true, name: true } },
                media: {
                  select: { id: true, type: true, publicUrl: true, createdAt: true, locked: true },
                  orderBy: { createdAt: "desc" },
                },
                complaints: {
                  select: {
                    id: true,
                    studentId: true,
                    severity: true,
                    resolved: true,
                    createdAt: true,
                    resolvedAt: true,
                    slaDeadline: true,
                    incidentFlag: true,
                  },
                  orderBy: { createdAt: "desc" },
                },
                occupancies: {
                  where: { endDate: null },
                  select: { id: true },
                },
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
        prisma.occupant.findMany({
          where: { studentId: student.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            publicId: true,
            unitId: true,
            active: true,
            createdAt: true,
          },
        }),
      ]);

      const latestVdp = student.vdpEntries[0] || null;
      const resolvedComplaints = complaints.filter((item) => item.resolved);
      const activeOccupant = occupants.find((item) => item.active) || null;
      const currentUnit = currentOccupancy?.unit || null;
      const profileStatus = currentOccupancy
        ? "active"
        : shortlistCount > 0
          ? "shortlisted"
          : latestVdp?.verified
            ? "verified"
            : "registered";

      let currentAccommodation = null;
      if (currentOccupancy && currentUnit) {
        const allUnitComplaints = Array.isArray(currentUnit.complaints) ? currentUnit.complaints : [];
        const cutoff = getWindowCutoff(HEALTH_WINDOW_DAYS);
        const complaints30d = allUnitComplaints.filter((item) => {
          const createdAt = item.createdAt ? new Date(item.createdAt) : null;
          return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
        });
        const resolved30d = complaints30d.filter((item) => item.resolved);
        const avgResolutionHours30d = getAvgResolutionHours(resolved30d);
        const incidents30d = complaints30d.filter((item) => item.incidentFlag).length;
        const slaBreaches30d = complaints30d.filter(isSlaBreach).length;
        const myOpenComplaints = allUnitComplaints.filter((item) => item.studentId === student.id && !item.resolved).length;
        const currentOpenComplaints = complaints30d.filter((item) => !item.resolved).length;
        const occupancyCount = Array.isArray(currentUnit.occupancies) ? currentUnit.occupancies.length : 0;
        const availableSlots = Math.max((currentUnit.capacity || 0) - occupancyCount, 0);
        const trustBand = getTrustBand(currentUnit.trustScore);
        const media = Array.isArray(currentUnit.media) ? currentUnit.media : [];
        const mediaByType = {
          photos: media.filter((item) => item.type === "photo"),
          documents: media.filter((item) => item.type === "document"),
          walkthroughs360: media.filter((item) => item.type === "walkthrough360"),
        };

        const trendCurrent14d = complaints30d.filter((item) => {
          const createdAt = new Date(item.createdAt);
          const cutoff14 = getWindowCutoff(14);
          return createdAt >= cutoff14;
        }).length;
        const trendPrevious14d = complaints30d.filter((item) => {
          const createdAt = new Date(item.createdAt);
          const end = getWindowCutoff(14);
          const start = getWindowCutoff(28);
          return createdAt >= start && createdAt < end;
        }).length;

        currentAccommodation = {
          identity: {
            unitId: currentUnit.id,
            unitLabel: `Unit #${currentUnit.id}`,
            hostelLabel: `Hostel Unit #${currentUnit.id}`,
            corridor: currentUnit.corridor ? { id: currentUnit.corridor.id, name: currentUnit.corridor.name } : null,
            roomNumber: activeOccupant?.roomNumber || null,
            bedSlot: activeOccupant?.occupantIndex || null,
            occupantId: activeOccupant?.publicId || null,
            occupantIdDisplay: formatOccupantPublicId(activeOccupant?.publicId || null),
            checkInDate: currentOccupancy.startDate,
          },
          trust: {
            trustScore: currentUnit.trustScore,
            trustBand,
            status: currentUnit.status,
            auditRequired: currentUnit.auditRequired,
            complaintDensity30d: complaints30d.length,
            visibilityThresholdBreached: Number(currentUnit.trustScore) < 50,
            message:
              currentUnit.status === "suspended" || currentUnit.auditRequired
                ? "Unit under review. Corrective actions in progress."
                : Number(currentUnit.trustScore) < 50
                  ? "Unit currently under visibility threshold."
                  : "Unit is currently within governance visibility threshold.",
          },
          availability: {
            occupancyCount,
            capacity: currentUnit.capacity,
            availableSlots,
          },
          properties: {
            bedAvailable: currentUnit.bedAvailable,
            waterAvailable: currentUnit.waterAvailable,
            toiletsAvailable: currentUnit.toiletsAvailable,
            ventilationGood: currentUnit.ventilationGood,
            ac: currentUnit.ac,
            occupancyType: currentUnit.occupancyType,
            distanceKm: currentUnit.distanceKm,
            rent: currentUnit.rent,
            institutionProximityKm: currentUnit.institutionProximityKm,
          },
          media: mediaByType,
          complaintHealth: {
            windowDays: HEALTH_WINDOW_DAYS,
            totalComplaints30d: complaints30d.length,
            openComplaints30d: currentOpenComplaints,
            avgResolutionHours30d,
            slaBreaches30d,
            incidentFlags30d: incidents30d,
            myOpenComplaints,
            trend: {
              current14d: trendCurrent14d,
              previous14d: trendPrevious14d,
              direction:
                trendCurrent14d > trendPrevious14d
                  ? "up"
                  : trendCurrent14d < trendPrevious14d
                    ? "down"
                    : "flat",
            },
          },
          links: {
            unitPage: `/unit/${currentUnit.id}`,
            unitComplaintsPage: `/unit/${currentUnit.id}/complaints`,
          },
        };
      }

      return res.json({
        role: "student",
        identity: {
          name: student.name,
          studentId: student.id,
          institution: student.institution ? { id: student.institution.id, name: student.institution.name } : null,
          intake: student.intake,
          corridor: student.corridor ? { id: student.corridor.id, name: student.corridor.name } : null,
          joinedDate: user.createdAt,
          occupantId: activeOccupant?.publicId || null,
          occupantIdDisplay: formatOccupantPublicId(activeOccupant?.publicId || null),
          currentOccupantId: activeOccupant?.publicId || null,
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
                occupantId: activeOccupant?.publicId || null,
                occupantIdDisplay: formatOccupantPublicId(activeOccupant?.publicId || null),
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
          occupantIds: occupants.map((item) => ({
            id: item.id,
            publicId: item.publicId,
            publicIdDisplay: formatOccupantPublicId(item.publicId),
            unitId: item.unitId,
            active: item.active,
            createdAt: item.createdAt,
          })),
        },
        complaintSummary: {
          totalSubmitted: complaints.length,
          openComplaints: complaints.filter((item) => !item.resolved).length,
          avgResolutionHours: getAvgResolutionHours(resolvedComplaints),
          latest: complaints.slice(0, 5),
        },
        currentAccommodation,
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
