const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

async function getOwnedUnit(userId, unitId) {
  const landlord = await prisma.landlord.findFirst({
    where: { userId },
  });
  if (!landlord) {
    return { error: "Landlord profile not found", status: 403 };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
  });
  if (!unit) {
    return { error: "Unit not found", status: 404 };
  }
  if (unit.landlordId !== landlord.id) {
    return { error: "You can only view your own units", status: 403 };
  }

  return { landlord, unit };
}

// GET /landlord/corridor/:id/demand-summary
// Returns aggregated demand data WITHOUT individual student details
router.get("/landlord/corridor/:corridorId/demand-summary", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    // Verify landlord has units in this corridor
    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const landlordUnits = await prisma.unit.findMany({
      where: { landlordId: landlord.id, corridorId },
      select: { id: true, capacity: true },
    });

    if (landlordUnits.length === 0) {
      return res.status(404).json({ error: "No units in this corridor" });
    }

    const unitIds = landlordUnits.map(u => u.id);
    const totalCapacity = landlordUnits.reduce((sum, u) => sum + (u.capacity || 0), 0);

    // Get VDP count for corridor (total verified students)
    const vdpCount = await prisma.vDPEntry.count({
      where: { corridorId, verified: true },
    });

    // Get shortlists for landlord's units
    const shortlists = await prisma.shortlist.findMany({
      where: { unitId: { in: unitIds } },
      include: {
        student: {
          include: { institution: true },
        },
      },
    });

    // Count unique students who shortlisted landlord's units
    const shortlistStudentIds = [...new Set(shortlists.map(s => s.studentId))];
    const shortlistCount = shortlistStudentIds.length;

    // Get current occupancies in landlord's units
    const occupancies = await prisma.occupancy.findMany({
      where: { unitId: { in: unitIds }, endDate: null },
    });
    const currentOccupancy = occupancies.length;
    const occupancyGap = totalCapacity - currentOccupancy;

    // Get distribution by institution (aggregate only)
    const institutionMap = new Map();
    shortlists.forEach(s => {
      const instId = s.student.institution?.id || "unknown";
      const instName = s.student.institution?.name || "Unknown Institution";
      if (!institutionMap.has(instId)) {
        institutionMap.set(instId, { institutionId: instId, name: instName, shortlistCount: 0 });
      }
      institutionMap.get(instId).shortlistCount += 1;
    });

    // Get distribution by intake (aggregate only)
    const intakeMap = new Map();
    shortlists.forEach(s => {
      const intake = s.student.intake || "unknown";
      if (!intakeMap.has(intake)) {
        intakeMap.set(intake, { intake, shortlistCount: 0 });
      }
      intakeMap.get(intake).shortlistCount += 1;
    });

    // Calculate conversion ratio
    const conversionRatio = shortlistCount > 0 
      ? Number(((currentOccupancy / shortlistCount) * 100).toFixed(2))
      : 0;

    return res.json({
      corridorId,
      totalVdpStudents: vdpCount,
      shortlistCount,
      currentOccupancy,
      totalCapacity,
      occupancyGap,
      conversionRatio,
      distributionByInstitution: Array.from(institutionMap.values()),
      distributionByIntake: Array.from(intakeMap.values()),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /landlord/unit/:id/interested-students
// Returns students who shortlisted this specific unit
router.get("/landlord/unit/:unitId/interested-students", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }

    const ownership = await getOwnedUnit(req.user.id, unitId);
    if (ownership.error) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    // Get students who shortlisted this unit
    const shortlists = await prisma.shortlist.findMany({
      where: { unitId },
      include: {
        student: {
          include: {
            institution: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get current occupants of this unit
    const activeOccupants = await prisma.occupancy.findMany({
      where: { unitId, endDate: null },
      include: {
        student: {
          include: {
            institution: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    // Combine and mark status
    const interestedStudents = [
      ...activeOccupants.map(o => ({
        studentId: o.student.id,
        name: o.student.name,
        intake: o.student.intake,
        institutionName: o.student.institution?.name || null,
        email: o.student.user?.email || null,
        status: "occupant",
        since: o.startDate,
      })),
      ...shortlists
        .filter(s => !activeOccupants.some(o => o.studentId === s.studentId))
        .map(s => ({
          studentId: s.student.id,
          name: s.student.name,
          intake: s.student.intake,
          institutionName: s.student.institution?.name || null,
          email: s.student.user?.email || null,
          status: "shortlisted",
          since: s.createdAt,
        })),
    ];

    return res.json({
      unitId,
      totalInterested: interestedStudents.length,
      occupants: activeOccupants.length,
      shortlisted: shortlists.length - activeOccupants.filter(o => shortlists.some(s => s.studentId === o.studentId)).length,
      students: interestedStudents,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /landlord/unit/:unitId/overview
// Returns unit-level summary for landlord-owned unit
router.get("/landlord/unit/:unitId/overview", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }

    const ownership = await getOwnedUnit(req.user.id, unitId);
    if (ownership.error) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    const [activeOccupancyCount, shortlistCount, openAuditLogCount, activeComplaintCount, complaintCount, unitDetails] = await Promise.all([
      prisma.occupancy.count({ where: { unitId, endDate: null } }),
      prisma.shortlist.count({ where: { unitId } }),
      prisma.auditLog.count({ where: { unitId, resolved: false } }),
      prisma.complaint.count({ where: { unitId, resolved: false } }),
      prisma.complaint.count({ where: { unitId } }),
      prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          corridor: { select: { id: true, name: true } },
          structuralChecklist: true,
          operationalChecklist: true,
          media: {
            select: { id: true, type: true, url: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

    const mediaByType = { photo: [], document: [], walkthrough360: [] };
    (unitDetails?.media || []).forEach((item) => {
      const normalizedType = String(item.type || "").trim().toLowerCase();
      if (normalizedType === "photo") mediaByType.photo.push(item.url);
      if (normalizedType === "document") mediaByType.document.push(item.url);
      if (normalizedType === "360") mediaByType.walkthrough360.push(item.url);
    });

    return res.json({
      id: ownership.unit.id,
      status: ownership.unit.status,
      trustScore: ownership.unit.trustScore,
      structuralApproved: ownership.unit.structuralApproved,
      operationalBaselineApproved: ownership.unit.operationalBaselineApproved,
      auditRequired: ownership.unit.auditRequired,
      capacity: ownership.unit.capacity,
      occupancyCount: activeOccupancyCount,
      shortlistCount,
      complaintsCount: complaintCount,
      activeComplaints: activeComplaintCount,
      openAuditLogCount,
      corridor: unitDetails?.corridor || null,
      propertyDetails: {
        rent: ownership.unit.rent,
        distanceKm: ownership.unit.distanceKm,
        institutionProximityKm: ownership.unit.institutionProximityKm,
        occupancyType: ownership.unit.occupancyType,
        ac: ownership.unit.ac,
        bedAvailable: ownership.unit.bedAvailable,
        waterAvailable: ownership.unit.waterAvailable,
        toiletsAvailable: ownership.unit.toiletsAvailable,
        ventilationGood: ownership.unit.ventilationGood,
      },
      declarations: {
        selfDeclaration: unitDetails?.operationalChecklist?.selfDeclaration || null,
      },
      checklists: {
        structural: unitDetails?.structuralChecklist || null,
        operational: unitDetails?.operationalChecklist || null,
      },
      media: {
        byType: mediaByType,
        all: unitDetails?.media || [],
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /landlord/unit/:unitId/complaints
// Returns complaint details for landlord-owned unit
router.get("/landlord/unit/:unitId/complaints", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }

    const ownership = await getOwnedUnit(req.user.id, unitId);
    if (ownership.error) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    const complaints = await prisma.complaint.findMany({
      where: { unitId },
      include: {
        student: {
          include: {
            institution: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      unitId,
      totalComplaints: complaints.length,
      activeComplaints: complaints.filter((item) => !item.resolved).length,
      complaints: complaints.map((item) => ({
        id: item.id,
        severity: item.severity,
        incidentType: item.incidentType,
        incidentFlag: item.incidentFlag,
        resolved: item.resolved,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
        slaDeadline: item.slaDeadline,
        isSlaBreached:
          item.resolved && item.resolvedAt && item.slaDeadline
            ? new Date(item.resolvedAt) > new Date(item.slaDeadline)
            : false,
        student: {
          id: item.student.id,
          name: item.student.name,
          intake: item.student.intake,
          institutionName: item.student.institution?.name || null,
          email: item.student.user?.email || null,
        },
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /landlord/unit/:unitId/audit-logs
// Returns audit logs for landlord-owned unit
router.get("/landlord/unit/:unitId/audit-logs", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }

    const ownership = await getOwnedUnit(req.user.id, unitId);
    if (ownership.error) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    const logs = await prisma.auditLog.findMany({
      where: { unitId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      unitId,
      totalLogs: logs.length,
      openLogs: logs.filter((item) => !item.resolved).length,
      logs,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
