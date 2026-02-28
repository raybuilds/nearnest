const express = require("express");
const multer = require("multer");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");
const { uploadFile } = require("../services/storageService");

const router = express.Router();
const EXPLAIN_WINDOW_DAYS = 30;
const UNIT_STATUSES = new Set(["draft", "submitted", "admin_review", "approved", "rejected", "suspended", "archived"]);
const DEFAULT_RANDOM_AUDIT_SAMPLE = 3;
const MAX_RANDOM_AUDIT_SAMPLE = 20;
const MEDIA_TYPES = new Set(["photo", "document", "walkthrough360"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

function getTrustBand(trustScore) {
  if (trustScore < 50) return "hidden";
  if (trustScore < 80) return "standard";
  return "priority";
}

function isLateResolvedComplaint(complaint) {
  if (!complaint.resolved || !complaint.resolvedAt || !complaint.slaDeadline) {
    return false;
  }
  return new Date(complaint.resolvedAt) > new Date(complaint.slaDeadline);
}

function getVisibilityReasons(unit) {
  const reasons = [];

  if (unit.status !== "approved") {
    reasons.push(`status is ${unit.status}`);
  }
  if (!unit.structuralApproved) {
    reasons.push("structural baseline not approved");
  }
  if (!unit.operationalBaselineApproved) {
    reasons.push("operational baseline not approved");
  }
  if (Number(unit.trustScore) < 50) {
    reasons.push("trust score below visibility threshold (50)");
  }

  return reasons;
}

function isVisibleToStudents(unit) {
  return (
    unit.status === "approved" &&
    unit.structuralApproved &&
    unit.operationalBaselineApproved &&
    Number(unit.trustScore) >= 50
  );
}

function getComplaintWindowCount(complaints, days) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return complaints.filter((complaint) => {
    if (!complaint.createdAt) return false;
    const createdAt = new Date(complaint.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
  }).length;
}

function getResolutionHours(complaint) {
  if (!complaint.resolvedAt || !complaint.createdAt) return null;
  const resolvedAt = new Date(complaint.resolvedAt);
  const createdAt = new Date(complaint.createdAt);
  if (Number.isNaN(resolvedAt.getTime()) || Number.isNaN(createdAt.getTime())) return null;
  return (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
}

async function getLandlordFromUser(userId) {
  return prisma.landlord.findFirst({
    where: { userId },
  });
}

function normalizeMediaType(rawType) {
  const value = String(rawType || "").trim().toLowerCase();
  if (value === "360") return "walkthrough360";
  return value;
}

function isAllowedMimeType(type, mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (type === "photo") {
    return normalized.startsWith("image/");
  }
  if (type === "document") {
    return (
      normalized === "application/pdf" ||
      normalized === "application/msword" ||
      normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      normalized.startsWith("text/") ||
      normalized.startsWith("image/")
    );
  }
  if (type === "walkthrough360") {
    return (
      normalized === "text/html" ||
      normalized === "application/zip" ||
      normalized === "application/x-zip-compressed" ||
      normalized === "application/json" ||
      normalized.startsWith("video/") ||
      normalized.startsWith("image/")
    );
  }
  return false;
}

router.post("/unit", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const {
      corridorId,
      rent,
      distanceKm,
      ac,
      occupancyType,
      capacity,
      institutionProximityKm,
      bedAvailable,
      waterAvailable,
      toiletsAvailable,
      ventilationGood,
    } = req.body;

    if (!corridorId) {
      return res.status(400).json({ error: "corridorId is required" });
    }

    const corridor = await prisma.corridor.findUnique({
      where: { id: Number(corridorId) },
    });

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const parsedRent = rent === undefined ? 0 : Number(rent);
    const parsedDistanceKm = distanceKm === undefined ? 0 : Number(distanceKm);
    const parsedCapacity = capacity === undefined ? 1 : Number(capacity);
    const parsedInstitutionProximityKm = institutionProximityKm === undefined ? 0 : Number(institutionProximityKm);
    const parsedToiletsAvailable = toiletsAvailable === undefined ? 1 : Number(toiletsAvailable);

    if (!Number.isInteger(parsedRent) || parsedRent < 0) {
      return res.status(400).json({ error: "rent must be a non-negative integer" });
    }

    if (Number.isNaN(parsedDistanceKm) || parsedDistanceKm < 0) {
      return res.status(400).json({ error: "distanceKm must be a non-negative number" });
    }
    if (Number.isNaN(parsedInstitutionProximityKm) || parsedInstitutionProximityKm < 0) {
      return res.status(400).json({ error: "institutionProximityKm must be a non-negative number" });
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({ error: "capacity must be a positive integer" });
    }
    if (!Number.isInteger(parsedToiletsAvailable) || parsedToiletsAvailable < 0) {
      return res.status(400).json({ error: "toiletsAvailable must be a non-negative integer" });
    }

    if (ac !== undefined && typeof ac !== "boolean") {
      return res.status(400).json({ error: "ac must be a boolean" });
    }

    if (occupancyType !== undefined && typeof occupancyType !== "string") {
      return res.status(400).json({ error: "occupancyType must be a string" });
    }
    if (bedAvailable !== undefined && typeof bedAvailable !== "boolean") {
      return res.status(400).json({ error: "bedAvailable must be a boolean" });
    }
    if (waterAvailable !== undefined && typeof waterAvailable !== "boolean") {
      return res.status(400).json({ error: "waterAvailable must be a boolean" });
    }
    if (ventilationGood !== undefined && typeof ventilationGood !== "boolean") {
      return res.status(400).json({ error: "ventilationGood must be a boolean" });
    }

    const unit = await prisma.unit.create({
      data: {
        corridorId: Number(corridorId),
        status: "draft",
        structuralApproved: false,
        operationalBaselineApproved: false,
        rent: parsedRent,
        distanceKm: parsedDistanceKm,
        institutionProximityKm: parsedInstitutionProximityKm,
        ac: ac === undefined ? false : ac,
        occupancyType: occupancyType === undefined ? "unknown" : occupancyType.trim(),
        bedAvailable: bedAvailable === undefined ? true : bedAvailable,
        waterAvailable: waterAvailable === undefined ? true : waterAvailable,
        toiletsAvailable: parsedToiletsAvailable,
        ventilationGood: ventilationGood === undefined ? true : ventilationGood,
        capacity: parsedCapacity,
        landlordId: landlord.id,
      },
    });

    res.status(201).json(unit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/units/:corridorId", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    const { maxRent, ac, maxDistance } = req.query;

    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(403).json({ error: "Student profile not found" });
    }

    let parsedMaxRent;
    if (maxRent !== undefined) {
      parsedMaxRent = Number(maxRent);
      if (!Number.isInteger(parsedMaxRent) || parsedMaxRent < 0) {
        return res.status(400).json({ error: "maxRent must be a non-negative integer" });
      }
    }

    let parsedAc;
    if (ac !== undefined) {
      if (ac !== "true" && ac !== "false") {
        return res.status(400).json({ error: "ac filter must be true or false" });
      }
      parsedAc = ac === "true";
    }

    let parsedMaxDistance;
    if (maxDistance !== undefined) {
      parsedMaxDistance = Number(maxDistance);
      if (Number.isNaN(parsedMaxDistance) || parsedMaxDistance < 0) {
        return res.status(400).json({ error: "maxDistance must be a non-negative number" });
      }
    }

    const vdpEntry = await prisma.vDPEntry.findFirst({
      where: {
        studentId: student.id,
        corridorId,
        verified: true,
      },
    });

    if (!vdpEntry) {
      return res.status(403).json({ error: "Not in verified demand pool" });
    }

    const where = {
      corridorId,
      status: "approved",
      structuralApproved: true,
      operationalBaselineApproved: true,
      trustScore: { gte: 50 },
    };

    if (parsedMaxRent !== undefined) {
      where.rent = { lte: parsedMaxRent };
    }
    if (parsedAc !== undefined) {
      where.ac = parsedAc;
    }
    if (parsedMaxDistance !== undefined) {
      where.distanceKm = { lte: parsedMaxDistance };
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        occupancies: {
          where: { endDate: null },
          select: { id: true },
        },
      },
      orderBy: { trustScore: "desc" },
    });

    const unitsWithBand = units.map((unit) => ({
      id: unit.id,
      corridorId: unit.corridorId,
      status: unit.status,
      trustScore: unit.trustScore,
      trustBand: getTrustBand(unit.trustScore),
      rent: unit.rent,
      distanceKm: unit.distanceKm,
      institutionProximityKm: unit.institutionProximityKm,
      ac: unit.ac,
      occupancyType: unit.occupancyType,
      capacity: unit.capacity,
      bedAvailable: unit.bedAvailable,
      waterAvailable: unit.waterAvailable,
      toiletsAvailable: unit.toiletsAvailable,
      ventilationGood: unit.ventilationGood,
      occupancyCount: unit.occupancies.length,
      availableSlots: Math.max(unit.capacity - unit.occupancies.length, 0),
    }));

    res.json(unitsWithBand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/units/:corridorId/hidden-reasons", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

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
        corridorId,
        verified: true,
      },
    });

    if (!vdpEntry) {
      return res.status(403).json({ error: "Not in verified demand pool" });
    }

    const units = await prisma.unit.findMany({
      where: { corridorId },
      select: {
        id: true,
        status: true,
        structuralApproved: true,
        operationalBaselineApproved: true,
        trustScore: true,
      },
      orderBy: { id: "asc" },
    });

    const hidden = units
      .filter((unit) => !isVisibleToStudents(unit))
      .map((unit) => ({
        unitId: unit.id,
        reasons: getVisibilityReasons(unit),
      }));

    return res.json({
      hiddenCount: hidden.length,
      hiddenUnits: hidden,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/landlord/units", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - EXPLAIN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const units = await prisma.unit.findMany({
      where: { landlordId: landlord.id },
      include: {
        complaints: {
          select: {
            resolved: true,
            createdAt: true,
            resolvedAt: true,
            slaDeadline: true,
          },
        },
        occupancies: {
          where: { endDate: null },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                intake: true,
                institution: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { startDate: "desc" },
        },
        shortlists: {
          select: { id: true, studentId: true, createdAt: true },
        },
        structuralChecklist: true,
        operationalChecklist: true,
        media: {
          select: { id: true, type: true, publicUrl: true, createdAt: true, locked: true },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          where: { resolved: false },
          select: { id: true },
        },
      },
      orderBy: { id: "desc" },
    });

    const payload = units.map((unit) => {
      const activeComplaints = unit.complaints.filter((complaint) => !complaint.resolved).length;
      const complaintsLast30Days = unit.complaints.filter((complaint) => {
        if (!complaint.createdAt) return false;
        const createdAt = new Date(complaint.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
      }).length;
      const slaLateCount = unit.complaints.filter(isLateResolvedComplaint).length;

      return {
        id: unit.id,
        status: unit.status,
        trustScore: unit.trustScore,
        trustBand: getTrustBand(unit.trustScore),
        visibleToStudents:
          isVisibleToStudents(unit),
        structuralApproved: unit.structuralApproved,
        operationalBaselineApproved: unit.operationalBaselineApproved,
        auditRequired: unit.auditRequired,
        structuralChecklistApproved: unit.structuralChecklist?.approved || false,
        operationalChecklistApproved: unit.operationalChecklist?.approved || false,
        falseDeclarationCount: unit.falseDeclarationCount,
        activeComplaints,
        complaintsLast30Days,
        slaLateCount,
        capacity: unit.capacity,
        occupancyCount: unit.occupancies.length,
        openAuditLogCount: unit.auditLogs.length,
        mediaCount: unit.media.length,
        mediaTypesSubmitted: Array.from(new Set(unit.media.map((item) => String(item.type).trim().toLowerCase()))),
        shortlistedCount: unit.shortlists.length,
        activeOccupants: unit.occupancies.map((occupancy) => ({
          occupancyId: occupancy.id,
          studentId: occupancy.student.id,
          name: occupancy.student.name,
          intake: occupancy.student.intake,
          institutionId: occupancy.student.institution?.id || null,
          institutionName: occupancy.student.institution?.name || null,
          startDate: occupancy.startDate,
        })),
      };
    });

    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.put("/unit/:id/structural-checklist", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const { fireExit, wiringSafe, plumbingSafe, occupancyCompliant } = req.body;

    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }

    const checklist = await prisma.structuralChecklist.upsert({
      where: { unitId },
      create: {
        unitId,
        fireExit: Boolean(fireExit),
        wiringSafe: Boolean(wiringSafe),
        plumbingSafe: Boolean(plumbingSafe),
        occupancyCompliant: Boolean(occupancyCompliant),
      },
      update: {
        fireExit: Boolean(fireExit),
        wiringSafe: Boolean(wiringSafe),
        plumbingSafe: Boolean(plumbingSafe),
        occupancyCompliant: Boolean(occupancyCompliant),
      },
    });

    return res.json(checklist);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.put("/unit/:id/operational-checklist", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const { bedAvailable, waterAvailable, toiletsAvailable, ventilationGood, selfDeclaration } = req.body;

    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }

    const checklist = await prisma.operationalChecklist.upsert({
      where: { unitId },
      create: {
        unitId,
        bedAvailable: Boolean(bedAvailable),
        waterAvailable: Boolean(waterAvailable),
        toiletsAvailable: Boolean(toiletsAvailable),
        ventilationGood: Boolean(ventilationGood),
        selfDeclaration: selfDeclaration ? String(selfDeclaration).trim() : null,
      },
      update: {
        bedAvailable: Boolean(bedAvailable),
        waterAvailable: Boolean(waterAvailable),
        toiletsAvailable: Boolean(toiletsAvailable),
        ventilationGood: Boolean(ventilationGood),
        selfDeclaration: selfDeclaration ? String(selfDeclaration).trim() : null,
      },
    });

    return res.json(checklist);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/unit/:id/media", verifyToken, requireRole("landlord"), upload.single("file"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const normalizedType = normalizeMediaType(req.body?.type);
    if (!MEDIA_TYPES.has(normalizedType)) {
      return res.status(400).json({ error: "media type must be photo, document, or walkthrough360" });
    }

    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }
    if (unit.status !== "draft") {
      return res.status(400).json({ error: "Media can only be uploaded while unit status is draft" });
    }

    const existingLockedMedia = await prisma.unitMedia.count({
      where: { unitId, locked: true },
    });
    if (existingLockedMedia > 0) {
      return res.status(400).json({ error: "Media is locked for this unit" });
    }

    let uploadMeta;
    if (req.file) {
      if (!isAllowedMimeType(normalizedType, req.file.mimetype)) {
        return res.status(400).json({ error: `Invalid file type for ${normalizedType}` });
      }
      uploadMeta = await uploadFile(req.file, `units/${unitId}`);
    } else if (req.body?.url) {
      // Backward-compatible path for existing UI flows that submit URLs.
      const externalUrl = String(req.body.url).trim();
      if (!externalUrl) {
        return res.status(400).json({ error: "file or url is required" });
      }
      uploadMeta = {
        storageKey: `external:${externalUrl}`,
        publicUrl: externalUrl,
        fileName: externalUrl.split("/").pop() || "external-link",
        mimeType: "application/octet-stream",
        sizeInBytes: 0,
      };
    } else {
      return res.status(400).json({ error: "file or url is required" });
    }

    const media = await prisma.unitMedia.create({
      data: {
        unitId,
        type: normalizedType,
        storageKey: uploadMeta.storageKey,
        publicUrl: uploadMeta.publicUrl || "",
        fileName: uploadMeta.fileName,
        mimeType: uploadMeta.mimeType,
        sizeInBytes: uploadMeta.sizeInBytes,
        uploadedById: req.user.id,
      },
    });

    if (!media.publicUrl || media.publicUrl === "") {
      const publicUrl = `/media/${media.id}`;
      await prisma.unitMedia.update({
        where: { id: media.id },
        data: { publicUrl },
      });
      media.publicUrl = publicUrl;
    }

    return res.status(201).json(media);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/unit/:id/submit", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const landlord = await getLandlordFromUser(req.user.id);
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        structuralChecklist: true,
        operationalChecklist: true,
        media: true,
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }
    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "You can only manage your own units" });
    }

    const submittedMediaTypes = new Set(unit.media.map((item) => String(item.type).trim().toLowerCase()));
    const missingMediaTypes = ["photo", "document", "walkthrough360"].filter((type) => !submittedMediaTypes.has(type));

    if (!unit.structuralChecklist || !unit.operationalChecklist || missingMediaTypes.length > 0) {
      return res.status(400).json({
        error: "Checklist and required media must be provided before submission",
        missingMediaTypes,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.unitMedia.updateMany({
        where: { unitId },
        data: { locked: true },
      });
      return tx.unit.update({
        where: { id: unitId },
        data: { status: "submitted" },
      });
    });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/units/:corridorId", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);

    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const units = await prisma.unit.findMany({
      where: { corridorId },
      include: {
        structuralChecklist: true,
        operationalChecklist: true,
      },
      orderBy: { trustScore: "desc" },
    });

    const unitsWithBand = units.map((unit) => ({
      ...unit,
      trustBand: getTrustBand(unit.trustScore),
      structuralChecklistApproved: unit.structuralChecklist?.approved || false,
      operationalChecklistApproved: unit.operationalChecklist?.approved || false,
    }));

    res.json(unitsWithBand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/unit/:id/review", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const { structuralApproved, operationalBaselineApproved, status } = req.body;

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        structuralChecklist: true,
        operationalChecklist: true,
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const data = {};
    if (typeof structuralApproved === "boolean") {
      if (structuralApproved) {
        const structural = await prisma.structuralChecklist.findUnique({
          where: { unitId },
        });
        const canApproveStructural =
          Boolean(structural) &&
          Boolean(structural.fireExit) &&
          Boolean(structural.wiringSafe) &&
          Boolean(structural.plumbingSafe) &&
          Boolean(structural.occupancyCompliant);

        if (!canApproveStructural) {
          return res.status(400).json({
            error: "Cannot approve structural baseline: all structural checklist items must be true",
          });
        }
      }

      data.structuralApproved = structuralApproved;
      await prisma.structuralChecklist.upsert({
        where: { unitId },
        create: {
          unitId,
          approved: structuralApproved,
        },
        update: {
          approved: structuralApproved,
        },
      });
    }
    if (typeof operationalBaselineApproved === "boolean") {
      if (operationalBaselineApproved) {
        const operational = await prisma.operationalChecklist.findUnique({
          where: { unitId },
        });
        const canApproveOperational =
          Boolean(operational) &&
          Boolean(operational.bedAvailable) &&
          Boolean(operational.waterAvailable) &&
          Boolean(operational.toiletsAvailable) &&
          Boolean(operational.ventilationGood);

        if (!canApproveOperational) {
          return res.status(400).json({
            error: "Cannot approve operational baseline: all operational checklist items must be true",
          });
        }
      }

      data.operationalBaselineApproved = operationalBaselineApproved;
      await prisma.operationalChecklist.upsert({
        where: { unitId },
        create: {
          unitId,
          approved: operationalBaselineApproved,
        },
        update: {
          approved: operationalBaselineApproved,
        },
      });
    }
    if (status !== undefined) {
      const normalizedStatus = String(status).trim();
      if (!UNIT_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({ error: "Invalid unit status" });
      }

      if (normalizedStatus === "approved") {
        const effectiveStructuralApproved =
          typeof data.structuralApproved === "boolean" ? data.structuralApproved : unit.structuralApproved;
        const effectiveOperationalApproved =
          typeof data.operationalBaselineApproved === "boolean"
            ? data.operationalBaselineApproved
            : unit.operationalBaselineApproved;

        if (!effectiveStructuralApproved || !effectiveOperationalApproved) {
          return res.status(400).json({
            error: "Cannot set status to approved: both structural and operational baselines must be approved",
          });
        }
        if (Number(unit.trustScore) < 50) {
          return res.status(400).json({
            error: "Cannot set status to approved: trust score must be at least 50",
          });
        }
        if (unit.auditRequired) {
          return res.status(400).json({
            error: "Cannot set status to approved while auditRequired is true",
          });
        }
      }

      data.status = normalizedStatus;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No review updates provided" });
    }

    if (
      data.structuralApproved &&
      data.operationalBaselineApproved &&
      !data.status &&
      Number(unit.trustScore) >= 50 &&
      !unit.auditRequired
    ) {
      data.status = "approved";
    } else if (!data.status && unit.status === "submitted") {
      data.status = "admin_review";
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data,
    });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/unit/:id/status", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }
    const normalizedStatus = String(status).trim();
    if (!UNIT_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ error: "Invalid unit status" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        status: true,
        structuralApproved: true,
        operationalBaselineApproved: true,
        trustScore: true,
        auditRequired: true,
      },
    });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (normalizedStatus === "approved") {
      if (!unit.structuralApproved || !unit.operationalBaselineApproved) {
        return res.status(400).json({
          error: "Cannot set status to approved: both structural and operational baselines must be approved",
        });
      }
      if (Number(unit.trustScore) < 50) {
        return res.status(400).json({
          error: "Cannot set status to approved: trust score must be at least 50",
        });
      }
      if (unit.auditRequired) {
        return res.status(400).json({
          error: "Cannot set status to approved while auditRequired is true",
        });
      }
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: { status: normalizedStatus },
    });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/unit/:id/structural-checklist", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const { fireExit, wiringSafe, plumbingSafe, occupancyCompliant } = req.body;
    const providedKeys = [fireExit, wiringSafe, plumbingSafe, occupancyCompliant].filter((value) => value !== undefined);
    if (providedKeys.length === 0) {
      return res.status(400).json({ error: "At least one structural checklist field is required" });
    }

    if (
      (fireExit !== undefined && typeof fireExit !== "boolean") ||
      (wiringSafe !== undefined && typeof wiringSafe !== "boolean") ||
      (plumbingSafe !== undefined && typeof plumbingSafe !== "boolean") ||
      (occupancyCompliant !== undefined && typeof occupancyCompliant !== "boolean")
    ) {
      return res.status(400).json({ error: "Structural checklist fields must be boolean values" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const current = await prisma.structuralChecklist.findUnique({ where: { unitId } });
    const merged = {
      fireExit: fireExit === undefined ? Boolean(current?.fireExit) : fireExit,
      wiringSafe: wiringSafe === undefined ? Boolean(current?.wiringSafe) : wiringSafe,
      plumbingSafe: plumbingSafe === undefined ? Boolean(current?.plumbingSafe) : plumbingSafe,
      occupancyCompliant: occupancyCompliant === undefined ? Boolean(current?.occupancyCompliant) : occupancyCompliant,
    };
    const approved =
      Boolean(merged.fireExit) &&
      Boolean(merged.wiringSafe) &&
      Boolean(merged.plumbingSafe) &&
      Boolean(merged.occupancyCompliant);

    const checklist = await prisma.structuralChecklist.upsert({
      where: { unitId },
      create: {
        unitId,
        ...merged,
        approved,
      },
      update: {
        ...merged,
        approved,
      },
    });

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        structuralApproved: approved,
        ...(unit.status === "approved" && !approved ? { status: "admin_review" } : {}),
      },
    });

    return res.json(checklist);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/unit/:id/operational-checklist", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const { bedAvailable, waterAvailable, toiletsAvailable, ventilationGood, selfDeclaration } = req.body;
    const providedKeys = [bedAvailable, waterAvailable, toiletsAvailable, ventilationGood, selfDeclaration].filter((value) => value !== undefined);
    if (providedKeys.length === 0) {
      return res.status(400).json({ error: "At least one operational checklist field is required" });
    }

    if (
      (bedAvailable !== undefined && typeof bedAvailable !== "boolean") ||
      (waterAvailable !== undefined && typeof waterAvailable !== "boolean") ||
      (toiletsAvailable !== undefined && typeof toiletsAvailable !== "boolean") ||
      (ventilationGood !== undefined && typeof ventilationGood !== "boolean")
    ) {
      return res.status(400).json({ error: "Operational checklist boolean fields must be boolean values" });
    }
    if (selfDeclaration !== undefined && selfDeclaration !== null && typeof selfDeclaration !== "string") {
      return res.status(400).json({ error: "selfDeclaration must be a string when provided" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const current = await prisma.operationalChecklist.findUnique({ where: { unitId } });
    const merged = {
      bedAvailable: bedAvailable === undefined ? Boolean(current?.bedAvailable) : bedAvailable,
      waterAvailable: waterAvailable === undefined ? Boolean(current?.waterAvailable) : waterAvailable,
      toiletsAvailable: toiletsAvailable === undefined ? Boolean(current?.toiletsAvailable) : toiletsAvailable,
      ventilationGood: ventilationGood === undefined ? Boolean(current?.ventilationGood) : ventilationGood,
      selfDeclaration:
        selfDeclaration === undefined
          ? current?.selfDeclaration || null
          : selfDeclaration === null
            ? null
            : String(selfDeclaration).trim(),
    };
    const approved =
      Boolean(merged.bedAvailable) &&
      Boolean(merged.waterAvailable) &&
      Boolean(merged.toiletsAvailable) &&
      Boolean(merged.ventilationGood);

    const checklist = await prisma.operationalChecklist.upsert({
      where: { unitId },
      create: {
        unitId,
        ...merged,
        approved,
      },
      update: {
        ...merged,
        approved,
      },
    });

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        operationalBaselineApproved: approved,
        ...(unit.status === "approved" && !approved ? { status: "admin_review" } : {}),
      },
    });

    return res.json(checklist);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/admin/unit/:id/audit-log", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const log = await prisma.auditLog.create({
      data: {
        unitId,
        reason: String(reason).trim(),
      },
    });

    await prisma.unit.update({
      where: { id: unitId },
      data: {
        auditRequired: true,
        status: unit.status === "archived" ? unit.status : "suspended",
      },
    });

    return res.status(201).json(log);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/admin/unit/:id/self-declaration/penalize", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const { reason, penaltyPoints } = req.body;
    const parsedPenalty = penaltyPoints === undefined ? 8 : Number(penaltyPoints);
    if (Number.isNaN(parsedPenalty) || parsedPenalty <= 0) {
      return res.status(400).json({ error: "penaltyPoints must be a positive number" });
    }
    if (!reason || String(reason).trim() === "") {
      return res.status(400).json({ error: "reason is required" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const nextTrust = Math.max(Number(unit.trustScore) - parsedPenalty, 0);

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          unitId,
          triggerType: "misrepresentation",
          reason: `Self-declaration misrepresentation: ${String(reason).trim()}`,
        },
      });

      await tx.unit.update({
        where: { id: unitId },
        data: {
          trustScore: nextTrust,
          auditRequired: true,
          falseDeclarationCount: { increment: 1 },
          ...(unit.status === "archived" ? {} : { status: "suspended" }),
        },
      });
    });

    return res.json({
      message: "Misrepresentation penalty applied",
      unitId,
      penaltyPoints: parsedPenalty,
      trustScore: nextTrust,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/audit/sample/:corridorId", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const requestedCount = req.query.count === undefined ? DEFAULT_RANDOM_AUDIT_SAMPLE : Number(req.query.count);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > MAX_RANDOM_AUDIT_SAMPLE) {
      return res.status(400).json({ error: `count must be an integer from 1 to ${MAX_RANDOM_AUDIT_SAMPLE}` });
    }

    const candidates = await prisma.unit.findMany({
      where: {
        corridorId,
        status: "approved",
        trustScore: { gte: 80 },
      },
      select: {
        id: true,
        trustScore: true,
        status: true,
      },
    });

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, requestedCount);

    return res.json({
      corridorId,
      candidateCount: candidates.length,
      sampledCount: selected.length,
      sampledUnits: selected.map((unit) => ({
        id: unit.id,
        trustScore: unit.trustScore,
        trustBand: getTrustBand(unit.trustScore),
        status: unit.status,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/audit-log/:id/corrective-plan", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const auditLogId = Number(req.params.id);
    if (Number.isNaN(auditLogId)) {
      return res.status(400).json({ error: "audit log id must be a number" });
    }

    const { correctiveAction, correctiveDeadline } = req.body;
    if (!correctiveAction || String(correctiveAction).trim() === "") {
      return res.status(400).json({ error: "correctiveAction is required" });
    }

    let parsedDeadline = null;
    if (correctiveDeadline !== undefined && correctiveDeadline !== null && String(correctiveDeadline).trim() !== "") {
      parsedDeadline = new Date(correctiveDeadline);
      if (Number.isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ error: "correctiveDeadline must be a valid date" });
      }
    }

    const existing = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!existing) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    const updated = await prisma.auditLog.update({
      where: { id: auditLogId },
      data: {
        correctiveAction: String(correctiveAction).trim(),
        correctiveDeadline: parsedDeadline,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.patch("/admin/audit-log/:id/resolve", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const auditLogId = Number(req.params.id);
    if (Number.isNaN(auditLogId)) {
      return res.status(400).json({ error: "audit log id must be a number" });
    }

    const { verificationNotes, reopenUnit } = req.body;

    const existing = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
    if (!existing) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    const resolvedLog = await prisma.auditLog.update({
      where: { id: auditLogId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        verificationNotes: verificationNotes ? String(verificationNotes).trim() : null,
      },
    });

    const unresolvedCount = await prisma.auditLog.count({
      where: {
        unitId: existing.unitId,
        resolved: false,
      },
    });

    const unit = await prisma.unit.findUnique({ where: { id: existing.unitId } });
    if (unit) {
      const shouldReopen = reopenUnit === undefined ? true : Boolean(reopenUnit);
      const canReopen =
        shouldReopen &&
        unresolvedCount === 0 &&
        unit.status !== "archived" &&
        unit.structuralApproved &&
        unit.operationalBaselineApproved &&
        Number(unit.trustScore) >= 50;

      await prisma.unit.update({
        where: { id: unit.id },
        data: {
          auditRequired: unresolvedCount > 0,
          ...(canReopen ? { status: "approved" } : {}),
        },
      });
    }

    return res.json({
      message: "Audit log resolved",
      auditLog: resolvedLog,
      unresolvedAuditLogs: unresolvedCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/unit/:id/audit-logs", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }
    const logs = await prisma.auditLog.findMany({
      where: { unitId },
      orderBy: { createdAt: "desc" },
    });
    return res.json(logs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/audit/:corridorId", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);

    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const units = await prisma.unit.findMany({
      where: {
        corridorId,
        auditRequired: true,
      },
      orderBy: { trustScore: "asc" },
    });

    const unitsWithBand = units.map((unit) => ({
      ...unit,
      trustBand: getTrustBand(unit.trustScore),
    }));

    res.json(unitsWithBand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/unit/:id/explain", verifyToken, async (req, res) => {
  try {
    const unitId = Number(req.params.id);

    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        complaints: {
          select: {
            resolved: true,
            createdAt: true,
          },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - EXPLAIN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const activeComplaints = unit.complaints.filter((complaint) => !complaint.resolved).length;
    const complaintsLast30Days = unit.complaints.filter((complaint) => {
      if (!complaint.createdAt) {
        return false;
      }
      const createdAt = new Date(complaint.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
    }).length;

    return res.json({
      status: unit.status,
      structuralApproved: unit.structuralApproved,
      operationalBaselineApproved: unit.operationalBaselineApproved,
      trustScore: unit.trustScore,
      trustBand: getTrustBand(unit.trustScore),
      activeComplaints,
      complaintsLast30Days,
      auditRequired: unit.auditRequired,
      visibilityReasons: getVisibilityReasons(unit),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/unit/:id/details", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        corridor: { select: { id: true, name: true } },
        structuralChecklist: true,
        operationalChecklist: true,
        media: {
          select: { id: true, type: true, publicUrl: true, createdAt: true, locked: true },
          orderBy: { createdAt: "desc" },
        },
        complaints: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                intake: true,
                institution: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
        },
        occupancies: {
          where: { endDate: null },
          select: { id: true, studentId: true, startDate: true },
        },
        shortlists: {
          select: { id: true, studentId: true, createdAt: true },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const resolvedComplaints = unit.complaints.filter((complaint) => complaint.resolved);
    const lateResolvedCount = unit.complaints.filter(isLateResolvedComplaint).length;
    const resolutionHours = resolvedComplaints
      .map(getResolutionHours)
      .filter((value) => value !== null);
    const avgResolutionHours =
      resolutionHours.length === 0
        ? null
        : Number((resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length).toFixed(2));

    const severityDistribution = unit.complaints.reduce((acc, complaint) => {
      const key = String(complaint.severity);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const incidentTypeDistribution = unit.complaints.reduce((acc, complaint) => {
      if (!complaint.incidentType) return acc;
      acc[complaint.incidentType] = (acc[complaint.incidentType] || 0) + 1;
      return acc;
    }, {});

    const uniqueShortlistedStudents = new Set(unit.shortlists.map((entry) => entry.studentId)).size;
    const occupancyRatio = unit.capacity > 0 ? Number((unit.occupancies.length / unit.capacity).toFixed(4)) : 0;
    const conversionRate = uniqueShortlistedStudents > 0
      ? Number(((unit.occupancies.length / uniqueShortlistedStudents) * 100).toFixed(2))
      : 0;

    const structuralChecklist = unit.structuralChecklist
      ? {
          ...unit.structuralChecklist,
          approved:
            Boolean(unit.structuralChecklist.fireExit) &&
            Boolean(unit.structuralChecklist.wiringSafe) &&
            Boolean(unit.structuralChecklist.plumbingSafe) &&
            Boolean(unit.structuralChecklist.occupancyCompliant),
        }
      : null;

    const operationalChecklist = unit.operationalChecklist
      ? {
          ...unit.operationalChecklist,
          approved:
            Boolean(unit.operationalChecklist.bedAvailable) &&
            Boolean(unit.operationalChecklist.waterAvailable) &&
            Boolean(unit.operationalChecklist.toiletsAvailable) &&
            Boolean(unit.operationalChecklist.ventilationGood),
        }
      : null;

    return res.json({
      unitId: unit.id,
      governanceCore: {
        status: unit.status,
        structuralApproved: unit.structuralApproved,
        operationalBaselineApproved: unit.operationalBaselineApproved,
        trustScore: unit.trustScore,
        trustBand: getTrustBand(unit.trustScore),
        auditRequired: unit.auditRequired,
      },
      evidence: {
        corridor: unit.corridor,
        structuralChecklist,
        operationalChecklist,
        selfDeclaration: unit.operationalChecklist?.selfDeclaration || null,
        media: unit.media,
      },
      behavioralHistory: {
        complaintTimeline: unit.complaints.map((complaint) => ({
          id: complaint.id,
          severity: complaint.severity,
          resolved: complaint.resolved,
          createdAt: complaint.createdAt,
          resolvedAt: complaint.resolvedAt,
          slaDeadline: complaint.slaDeadline,
          incidentType: complaint.incidentType,
          incidentFlag: complaint.incidentFlag,
          student: complaint.student,
        })),
        slaMetrics: {
          totalComplaints: unit.complaints.length,
          resolvedComplaints: resolvedComplaints.length,
          unresolvedComplaints: unit.complaints.length - resolvedComplaints.length,
          lateResolvedCount,
          avgResolutionHours,
        },
        recurrenceAnalytics: {
          complaintsLast30Days: getComplaintWindowCount(unit.complaints, 30),
          complaintsLast60Days: getComplaintWindowCount(unit.complaints, 60),
          severityDistribution,
        },
        incidentFlags: {
          incidentFlaggedCount: unit.complaints.filter((complaint) => complaint.incidentFlag).length,
          incidentTypeDistribution,
        },
      },
      auditLayer: {
        allAuditLogs: unit.auditLogs,
        correctivePlans: unit.auditLogs
          .filter((log) => log.correctiveAction || log.correctiveDeadline)
          .map((log) => ({
            auditLogId: log.id,
            correctiveAction: log.correctiveAction,
            correctiveDeadline: log.correctiveDeadline,
            resolved: log.resolved,
          })),
        randomAuditHistory: unit.auditLogs.filter((log) => log.triggerType === "random_sample"),
      },
      demandContext: {
        shortlistCount: unit.shortlists.length,
        uniqueShortlistedStudents,
        activeOccupancyCount: unit.occupancies.length,
        occupancyRatio,
        conversionRate,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/student/unit/:id/details", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "unit id must be a number" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(403).json({ error: "Student profile not found" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        media: {
          select: { id: true, type: true, publicUrl: true, createdAt: true, locked: true },
          orderBy: { createdAt: "desc" },
        },
        occupancies: {
          where: { endDate: null },
          select: { id: true },
        },
        complaints: {
          select: {
            id: true,
            severity: true,
            resolved: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
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

    const visible = isVisibleToStudents(unit);
    const visibilityReasons = getVisibilityReasons(unit);
    const activeOccupancyCount = unit.occupancies.length;
    const availableSlots = Math.max((unit.capacity || 0) - activeOccupancyCount, 0);
    const complaintSummary = {
      totalComplaints: unit.complaints.length,
      activeComplaints: unit.complaints.filter((complaint) => !complaint.resolved).length,
      complaintsLast30Days: getComplaintWindowCount(unit.complaints, 30),
    };

    const ownComplaints = await prisma.complaint.findMany({
      where: {
        unitId,
        studentId: student.id,
      },
      select: {
        id: true,
        severity: true,
        resolved: true,
        createdAt: true,
        resolvedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      unitId: unit.id,
      discovery: {
        rent: unit.rent,
        distanceKm: unit.distanceKm,
        ac: unit.ac,
        occupancyType: unit.occupancyType,
        institutionProximityKm: unit.institutionProximityKm,
        media: unit.media,
      },
      availability: {
        occupancyCount: activeOccupancyCount,
        capacity: unit.capacity,
        availableSlots,
      },
      trustSignals: {
        trustScore: unit.trustScore,
        trustBand: getTrustBand(unit.trustScore),
        complaintSummary,
        lastAuditDate: unit.auditLogs.length > 0 ? unit.auditLogs[0].createdAt : null,
      },
      transparency: {
        visibleToStudents: visible,
        visibilityReasons,
        ownComplaintHistory: ownComplaints,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
