const express = require("express");
const prisma = require("../prismaClient");
const { calculateTrustScore } = require("../engines/trustEngine");
const { verifyToken, requireRole } = require("../middlewares/auth");
const { complaintLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();
const AUDIT_WINDOW_DAYS = 60;
const AUDIT_THRESHOLD = 5;
const SLA_BREACH_AUDIT_THRESHOLD = 3;
const INCIDENT_TYPES = new Set(["safety", "injury", "fire", "harassment", "water", "common_area", "other"]);
const SLA_HOURS = 48;
const DENSITY_WARNING_THRESHOLD = 3;
const COMPLAINT_STATUS_FILTERS = new Set(["open", "resolved", "late", "sla_breached"]);

function getSlaMeta(complaint) {
  const now = new Date();
  const deadline = complaint.slaDeadline ? new Date(complaint.slaDeadline) : null;
  const resolvedAt = complaint.resolvedAt ? new Date(complaint.resolvedAt) : null;
  const hasValidDeadline = deadline && !Number.isNaN(deadline.getTime());
  const hasValidResolvedAt = resolvedAt && !Number.isNaN(resolvedAt.getTime());

  let status = "unknown";
  if (complaint.resolved) {
    if (hasValidDeadline && hasValidResolvedAt && resolvedAt > deadline) {
      status = "late";
    } else {
      status = "resolved";
    }
  } else if (hasValidDeadline && now > deadline) {
    status = "sla_breached";
  } else {
    status = "open";
  }

  const countdownMs = !complaint.resolved && hasValidDeadline ? deadline.getTime() - now.getTime() : null;

  return {
    status,
    countdownMs,
  };
}

function getBaseTrustImpact(complaint) {
  let impact = complaint.severity * 2;
  if (!complaint.resolved) {
    impact += 5;
  }
  if (complaint.resolved && complaint.slaDeadline && complaint.resolvedAt) {
    const resolvedAt = new Date(complaint.resolvedAt);
    const deadline = new Date(complaint.slaDeadline);
    if (!Number.isNaN(resolvedAt.getTime()) && !Number.isNaN(deadline.getTime()) && resolvedAt > deadline) {
      impact += 3;
    }
  }
  return impact;
}

function getCreatedWithinDays(dateValue, days) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff;
}

function getAverageResolutionHours(complaints) {
  const hours = complaints
    .filter((item) => item.resolved && item.resolvedAt && item.createdAt)
    .map((item) => {
      const createdAt = new Date(item.createdAt);
      const resolvedAt = new Date(item.resolvedAt);
      if (Number.isNaN(createdAt.getTime()) || Number.isNaN(resolvedAt.getTime())) return null;
      return (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    })
    .filter((value) => value !== null);

  if (hours.length === 0) return null;
  return Number((hours.reduce((sum, value) => sum + value, 0) / hours.length).toFixed(2));
}

function getTrustBand(trustScore) {
  if (Number(trustScore) < 50) return "hidden";
  if (Number(trustScore) < 80) return "standard";
  return "priority";
}

function mapComplaintForList(complaint, includeStudent = false) {
  const sla = getSlaMeta(complaint);
  return {
    id: complaint.id,
    unitId: complaint.unitId,
    unitLabel: `Unit #${complaint.unitId}`,
    severity: complaint.severity,
    message: complaint.message || null,
    incidentType: complaint.incidentType || "other",
    incidentFlag: complaint.incidentFlag,
    resolved: complaint.resolved,
    createdAt: complaint.createdAt,
    resolvedAt: complaint.resolvedAt,
    slaDeadline: complaint.slaDeadline,
    slaStatus: sla.status,
    slaCountdownMs: sla.countdownMs,
    trustImpactHint: -getBaseTrustImpact(complaint),
    corridorId: complaint.unit?.corridorId ?? null,
    landlordId: complaint.unit?.landlordId ?? null,
    student: includeStudent
      ? {
          id: complaint.student?.id || null,
          name: complaint.student?.name || null,
          intake: complaint.student?.intake || null,
        }
      : undefined,
  };
}

function hasReachedAuditThreshold(complaints) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - AUDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const complaintsInWindow = complaints.filter((complaint) => {
    if (!complaint.createdAt) {
      return false;
    }

    const createdAt = new Date(complaint.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    return createdAt >= cutoff;
  }).length;

  return complaintsInWindow >= AUDIT_THRESHOLD;
}

function hasReachedSlaBreachThreshold(complaints) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - AUDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const lateResolvedInWindow = complaints.filter((complaint) => {
    if (!complaint.resolved || !complaint.resolvedAt || !complaint.slaDeadline) {
      return false;
    }

    const resolvedAt = new Date(complaint.resolvedAt);
    const slaDeadline = new Date(complaint.slaDeadline);

    if (Number.isNaN(resolvedAt.getTime()) || Number.isNaN(slaDeadline.getTime())) {
      return false;
    }

    return resolvedAt >= cutoff && resolvedAt > slaDeadline;
  }).length;

  return lateResolvedInWindow >= SLA_BREACH_AUDIT_THRESHOLD;
}

function hasIncidentFlagThreshold(complaints) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - AUDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const incidentCount = complaints.filter((complaint) => {
    if (!complaint.incidentFlag || !complaint.createdAt) {
      return false;
    }
    const createdAt = new Date(complaint.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }
    return createdAt >= cutoff;
  }).length;

  return incidentCount >= 1;
}

async function recalculateUnitTrustScore(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { complaints: true },
  });

  if (!unit) {
    return null;
  }

  const trustScore = calculateTrustScore(unit);
  const densityTriggered = hasReachedAuditThreshold(unit.complaints);
  const slaTriggered = hasReachedSlaBreachThreshold(unit.complaints);
  const incidentTriggered = hasIncidentFlagThreshold(unit.complaints);
  const shouldRequireAudit = unit.auditRequired || densityTriggered || slaTriggered || incidentTriggered;
  const newlyTriggered = !unit.auditRequired && (densityTriggered || slaTriggered || incidentTriggered);

  await prisma.$transaction(async (tx) => {
    await tx.unit.update({
      where: { id: unitId },
      data: {
        trustScore,
        auditRequired: shouldRequireAudit,
        ...(newlyTriggered && unit.status !== "archived" ? { status: "suspended" } : {}),
      },
    });

    if (newlyTriggered) {
      const reason = densityTriggered
        ? "Auto-triggered: complaint density threshold reached (5 complaints in 60 days)"
        : incidentTriggered
          ? "Auto-triggered: severe incident complaint raised"
          : "Auto-triggered: repeated SLA breaches detected in 60 days";
      const triggerType = densityTriggered ? "complaint_density" : incidentTriggered ? "incident" : "sla_breach";

      await tx.auditLog.create({
        data: {
          unitId,
          triggerType,
          reason,
        },
      });
    }
  });

  return trustScore;
}

router.post("/complaint", verifyToken, requireRole("student"), complaintLimiter, async (req, res) => {
  try {
    const { unitId, studentId, occupantId, severity, incidentType, message } = req.body;

    if ((!unitId && !occupantId) || severity === undefined) {
      return res.status(400).json({ error: "Provide occupantId or unitId, and severity" });
    }

    const parsedSeverity = Number(severity);
    if (!Number.isInteger(parsedSeverity) || parsedSeverity < 1 || parsedSeverity > 5) {
      return res.status(400).json({ error: "severity must be an integer from 1 to 5" });
    }

    let normalizedIncidentType = null;
    if (incidentType !== undefined && incidentType !== null && String(incidentType).trim() !== "") {
      normalizedIncidentType = String(incidentType).trim().toLowerCase();
      if (!INCIDENT_TYPES.has(normalizedIncidentType)) {
        return res.status(400).json({ error: "incidentType must be one of safety, injury, fire, harassment, water, common_area, other" });
      }
    }
    const incidentFlag = Boolean(normalizedIncidentType && normalizedIncidentType !== "other");
    let normalizedMessage = null;
    if (message !== undefined && message !== null && String(message).trim() !== "") {
      normalizedMessage = String(message).trim();
      if (normalizedMessage.length > 1200) {
        return res.status(400).json({ error: "message must be at most 1200 characters" });
      }
    }

    const requesterStudent = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });
    if (!requesterStudent) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    if (studentId !== undefined && studentId !== null && Number(studentId) !== requesterStudent.id) {
      return res.status(403).json({ error: "You can only file complaints as your own student identity" });
    }

    let resolvedUnitId = unitId ? Number(unitId) : null;
    let resolvedOccupantRecordId = null;
    if (unitId && Number.isNaN(resolvedUnitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }
    if (occupantId !== undefined && occupantId !== null && String(occupantId).trim() !== "") {
      const normalizedOccupantId = String(occupantId).trim();
      if (!/^\d{12}$/.test(normalizedOccupantId)) {
        return res.status(400).json({ error: "Invalid occupant ID" });
      }
      const occupant = await prisma.occupant.findUnique({
        where: { publicId: normalizedOccupantId },
        include: {
          unit: {
            select: {
              corridorId: true,
            },
          },
        },
      });
      if (!occupant || !occupant.active) {
        return res.status(400).json({ error: "Invalid occupant ID" });
      }
      if (occupant.studentId !== requesterStudent.id) {
        return res.status(400).json({ error: "Invalid occupant ID" });
      }
      if (!occupant.unit || occupant.unit.corridorId !== requesterStudent.corridorId) {
        return res.status(400).json({ error: "Invalid occupant ID" });
      }
      resolvedUnitId = occupant.unitId;
      resolvedOccupantRecordId = occupant.id;
    }

    if (!resolvedUnitId) {
      return res.status(400).json({ error: "Unit could not be resolved" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: resolvedUnitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.corridorId !== requesterStudent.corridorId) {
      return res.status(403).json({ error: "You can only file complaints in your corridor" });
    }


    const createdAt = new Date();
    const slaDeadline = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);

    const complaint = await prisma.complaint.create({
      data: {
        unitId: resolvedUnitId,
        occupantRecordId: resolvedOccupantRecordId,
        studentId: requesterStudent.id,
        severity: parsedSeverity,
        message: normalizedMessage,
        createdAt,
        slaDeadline,
        incidentType: normalizedIncidentType,
        incidentFlag,
      },
    });

    const trustScore = await recalculateUnitTrustScore(resolvedUnitId);

    res.status(201).json({
      message: "Complaint recorded",
      complaint,
      trustScore,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/complaint/:complaintId/resolve", verifyToken, requireRole("landlord", "admin"), async (req, res) => {
  try {
    const complaintId = Number(req.params.complaintId);

    if (Number.isNaN(complaintId)) {
      return res.status(400).json({ error: "complaintId must be a number" });
    }

    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    if (req.user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({
        where: { userId: req.user.id },
      });
      if (!landlord) {
        return res.status(403).json({ error: "Landlord profile not found" });
      }

      const unit = await prisma.unit.findUnique({
        where: { id: complaint.unitId },
        select: { landlordId: true },
      });

      if (!unit || unit.landlordId !== landlord.id) {
        return res.status(403).json({ error: "You can only resolve complaints for your own units" });
      }
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });

    const trustScore = await recalculateUnitTrustScore(updatedComplaint.unitId);

    res.json({
      message: "Complaint resolved",
      complaint: updatedComplaint,
      trustScore,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/complaints", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const complaints = await prisma.complaint.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        role: "student",
        total: complaints.length,
        complaints: complaints.map((item) => mapComplaintForList(item, false)),
      });
    }

    if (req.user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({
        where: { userId: req.user.id },
      });
      if (!landlord) {
        return res.status(403).json({ error: "Landlord profile not found" });
      }

      const unitId = req.query.unitId ? Number(req.query.unitId) : null;
      const incidentType = req.query.incidentType ? String(req.query.incidentType).trim().toLowerCase() : null;
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;

      if (unitId !== null && Number.isNaN(unitId)) {
        return res.status(400).json({ error: "unitId must be a number" });
      }
      if (incidentType && !INCIDENT_TYPES.has(incidentType)) {
        return res.status(400).json({ error: "Invalid incidentType filter" });
      }
      if (status && !COMPLAINT_STATUS_FILTERS.has(status)) {
        return res.status(400).json({ error: "Invalid status filter" });
      }

      const complaints = await prisma.complaint.findMany({
        where: {
          unit: {
            landlordId: landlord.id,
            ...(unitId ? { id: unitId } : {}),
          },
          ...(incidentType ? { incidentType } : {}),
        },
        include: {
          unit: { select: { id: true, corridorId: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      let filtered = complaints;
      if (status) {
        filtered = complaints.filter((item) => getSlaMeta(item).status === status);
      }

      const complaintsLast60Days = filtered.filter((item) => getCreatedWithinDays(item.createdAt, 60)).length;
      const complaintsLast30Days = filtered.filter((item) => getCreatedWithinDays(item.createdAt, 30)).length;
      const resolved = filtered.filter((item) => item.resolved);
      const late = filtered.filter((item) => getSlaMeta(item).status === "late");
      const slaCompliance = resolved.length === 0 ? null : Number((((resolved.length - late.length) / resolved.length) * 100).toFixed(2));

      const byUnitDensity = new Map();
      filtered.forEach((item) => {
        if (!getCreatedWithinDays(item.createdAt, 30)) return;
        const key = item.unitId;
        byUnitDensity.set(key, (byUnitDensity.get(key) || 0) + 1);
      });

      const densityWarnings = Array.from(byUnitDensity.entries())
        .filter(([, count]) => count >= DENSITY_WARNING_THRESHOLD)
        .map(([id, count]) => ({ unitId: id, complaintsLast30Days: count }));

      return res.json({
        role: "landlord",
        total: filtered.length,
        metrics: {
          openComplaints: filtered.filter((item) => !item.resolved).length,
          lateComplaints: late.length,
          complaintsLast30Days,
          complaintsLast60Days,
          avgResolutionHours: getAverageResolutionHours(filtered),
          slaCompliance,
          densityWarnings,
        },
        complaints: filtered.map((item) => mapComplaintForList(item, false)),
      });
    }

    if (req.user.role === "admin") {
      const corridorId = req.query.corridorId ? Number(req.query.corridorId) : null;
      const unitId = req.query.unitId ? Number(req.query.unitId) : null;
      const landlordId = req.query.landlordId ? Number(req.query.landlordId) : null;
      const incidentType = req.query.incidentType ? String(req.query.incidentType).trim().toLowerCase() : null;
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
      const slaBreachOnly = req.query.slaBreachOnly === "true";

      if ((corridorId !== null && Number.isNaN(corridorId)) || (unitId !== null && Number.isNaN(unitId)) || (landlordId !== null && Number.isNaN(landlordId))) {
        return res.status(400).json({ error: "corridorId, unitId, and landlordId must be numbers when provided" });
      }
      if (incidentType && !INCIDENT_TYPES.has(incidentType)) {
        return res.status(400).json({ error: "Invalid incidentType filter" });
      }
      if (status && !COMPLAINT_STATUS_FILTERS.has(status)) {
        return res.status(400).json({ error: "Invalid status filter" });
      }

      const complaints = await prisma.complaint.findMany({
        where: {
          unit: {
            ...(corridorId ? { corridorId } : {}),
            ...(unitId ? { id: unitId } : {}),
            ...(landlordId ? { landlordId } : {}),
          },
          ...(incidentType ? { incidentType } : {}),
        },
        include: {
          unit: {
            select: {
              id: true,
              corridorId: true,
              landlordId: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              intake: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      let filtered = complaints;
      if (status) {
        filtered = filtered.filter((item) => getSlaMeta(item).status === status);
      }
      if (slaBreachOnly) {
        filtered = filtered.filter((item) => {
          const sla = getSlaMeta(item);
          return sla.status === "late" || sla.status === "sla_breached";
        });
      }

      const complaintsByDay = new Map();
      filtered.forEach((item) => {
        if (!getCreatedWithinDays(item.createdAt, 14)) return;
        const date = new Date(item.createdAt);
        const key = date.toISOString().slice(0, 10);
        complaintsByDay.set(key, (complaintsByDay.get(key) || 0) + 1);
      });

      const densityByUnit = new Map();
      filtered.forEach((item) => {
        if (!getCreatedWithinDays(item.createdAt, 30)) return;
        densityByUnit.set(item.unitId, (densityByUnit.get(item.unitId) || 0) + 1);
      });

      const highDensityUnits = Array.from(densityByUnit.entries())
        .filter(([, count]) => count >= DENSITY_WARNING_THRESHOLD)
        .map(([id, count]) => ({ unitId: id, complaintsLast30Days: count }))
        .sort((a, b) => b.complaintsLast30Days - a.complaintsLast30Days);

      return res.json({
        role: "admin",
        total: filtered.length,
        metrics: {
          openComplaints: filtered.filter((item) => !item.resolved).length,
          lateOrBreached: filtered.filter((item) => {
            const sla = getSlaMeta(item);
            return sla.status === "late" || sla.status === "sla_breached";
          }).length,
          complaintsLast30Days: filtered.filter((item) => getCreatedWithinDays(item.createdAt, 30)).length,
          complaintsLast60Days: filtered.filter((item) => getCreatedWithinDays(item.createdAt, 60)).length,
          highDensityUnits,
          trendLast14Days: Array.from(complaintsByDay.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => (a.date > b.date ? 1 : -1)),
        },
        complaints: filtered.map((item) => mapComplaintForList(item, true)),
      });
    }

    return res.status(403).json({ error: "Unsupported role" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/unit/:unitId/complaints", verifyToken, async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unitId must be a number" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        corridorId: true,
        landlordId: true,
        trustScore: true,
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (req.user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const vdpEntry = await prisma.vDPEntry.findFirst({
        where: {
          studentId: student.id,
          corridorId: unit.corridorId,
          verified: true,
        },
      });
      if (!vdpEntry) {
        return res.status(403).json({ error: "Not in verified demand pool" });
      }

      const complaints = await prisma.complaint.findMany({
        where: { unitId },
        orderBy: { createdAt: "desc" },
      });

      const ownComplaints = await prisma.complaint.findMany({
        where: { unitId, studentId: student.id },
        orderBy: { createdAt: "desc" },
      });

      const incidentBreakdown = complaints.reduce((acc, item) => {
        const key = item.incidentType || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const complaints30d = complaints.filter((item) => getCreatedWithinDays(item.createdAt, 30));
      const resolved = complaints.filter((item) => item.resolved);
      const lateResolved = complaints.filter((item) => getSlaMeta(item).status === "late");
      const slaCompliance = resolved.length === 0 ? null : Number((((resolved.length - lateResolved.length) / resolved.length) * 100).toFixed(2));
      const slaBreaches30d = complaints30d.filter((item) => {
        const status = getSlaMeta(item).status;
        return status === "late" || status === "sla_breached";
      }).length;

      return res.json({
        role: "student",
        unitId,
        summary: {
          totalComplaints: complaints.length,
          activeComplaints: complaints.filter((item) => !item.resolved).length,
          complaintsLast30Days: complaints30d.length,
          avgResolutionHours30d: getAverageResolutionHours(complaints30d),
          slaBreaches30d,
          trustScore: unit.trustScore,
          trustBand: getTrustBand(unit.trustScore),
          incidentBreakdown,
          slaCompliance,
        },
        ownComplaints: ownComplaints.map((item) => mapComplaintForList(item, false)),
      });
    }

    if (req.user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({
        where: { userId: req.user.id },
      });
      if (!landlord || unit.landlordId !== landlord.id) {
        return res.status(403).json({ error: "You can only view your own unit complaints" });
      }
    }

    const complaints = await prisma.complaint.findMany({
      where: { unitId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            intake: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const incidentBreakdown = complaints.reduce((acc, item) => {
      const key = item.incidentType || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const severityTrend = complaints.reduce((acc, item) => {
      const key = String(item.severity);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const resolved = complaints.filter((item) => item.resolved);
    const lateResolved = complaints.filter((item) => getSlaMeta(item).status === "late");
    const slaCompliance = resolved.length === 0 ? null : Number((((resolved.length - lateResolved.length) / resolved.length) * 100).toFixed(2));
    const complaintsLast30Days = complaints.filter((item) => getCreatedWithinDays(item.createdAt, 30)).length;
    const complaintsLast60Days = complaints.filter((item) => getCreatedWithinDays(item.createdAt, 60)).length;
    const densityWarning = complaintsLast30Days >= DENSITY_WARNING_THRESHOLD;

    return res.json({
      role: req.user.role,
      unitId,
      metrics: {
        totalComplaints: complaints.length,
        activeComplaints: complaints.filter((item) => !item.resolved).length,
        complaintsLast30Days,
        complaintsLast60Days,
        densityWarning,
        avgResolutionHours: getAverageResolutionHours(complaints),
        slaCompliance,
        incidentBreakdown,
        severityTrend,
      },
      complaints: complaints.map((item) => mapComplaintForList(item, req.user.role === "admin")),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
