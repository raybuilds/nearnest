const express = require("express");
const multer = require("multer");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");
const storageService = require("../services/storageService");
const fs = require("fs");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function validatePdfFile(file) {
  if (!file) return { valid: false, error: "File is missing" };
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: "File exceeds 10MB limit" };
  }

  const ext = file.originalname ? file.originalname.split(".").pop().toLowerCase() : "";
  if (ext !== "pdf") {
    return { valid: false, error: "Invalid file extension. Only PDF is allowed" };
  }

  if (file.mimetype !== "application/pdf") {
    return { valid: false, error: "Invalid MIME type. Must be application/pdf" };
  }

  if (!file.buffer || file.buffer.length < 5) {
    return { valid: false, error: "Invalid file buffer" };
  }
  const magic = file.buffer.toString("utf8", 0, 5);
  if (magic !== "%PDF-") {
    return { valid: false, error: "File signature validation failed. Not a valid PDF file" };
  }

  return { valid: true };
}

// Helper to determine if agreement is expired deterministically (UTC timestamp based)
function getEffectiveAgreement(agreement) {
  if (!agreement) return null;
  if (agreement.status === "ACTIVE" && Date.now() > new Date(agreement.endDate).getTime()) {
    return { ...agreement, status: "EXPIRED" };
  }
  return agreement;
}

// Helper to determine if compliance is expired deterministically (UTC timestamp based)
function getEffectiveCompliance(comp) {
  if (!comp) return null;
  if (comp.status === "APPROVED" && comp.expiryDate && Date.now() > new Date(comp.expiryDate).getTime()) {
    return { ...comp, status: "EXPIRED" };
  }
  return comp;
}

// 1. POST /api/agreement - Create draft agreement (requires unit ownership)
router.post("/api/agreement", verifyToken, requireRole("landlord"), upload.single("document"), async (req, res) => {
  try {
    const { occupancyId, rentAmount, securityDeposit, noticePeriodDays, startDate, endDate } = req.body;
    const occId = Number(occupancyId);
    
    if (Number.isNaN(occId)) {
      return res.status(400).json({ error: "Invalid occupancy ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const occupancy = await prisma.occupancy.findUnique({
      where: { id: occId },
      include: { unit: true },
    });

    if (!occupancy) {
      return res.status(404).json({ error: "Occupancy record not found" });
    }

    if (occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    // Must start version calculation safely
    const existingCount = await prisma.agreement.count({
      where: { occupancyId: occId },
    });

    if (existingCount > 0) {
      return res.status(400).json({ error: "An agreement already exists for this occupancy. Use the version endpoint to create a new version." });
    }

    let documentPath = null;
    if (req.file) {
      const pdfCheck = validatePdfFile(req.file);
      if (!pdfCheck.valid) {
        return res.status(400).json({ error: pdfCheck.error });
      }
      const uploadRes = await storageService.uploadFile(req.file, `agreements/${occId}`);
      documentPath = uploadRes.storageKey;
    }

    try {
      const agreement = await prisma.agreement.create({
        data: {
          occupancyId: occId,
          version: 1,
          status: "DRAFT",
          rentAmount: Number(rentAmount),
          securityDeposit: Number(securityDeposit),
          noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : 30,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          documentPath,
        },
      });

      return res.status(201).json(agreement);
    } catch (dbError) {
      if (documentPath) {
        try {
          await storageService.deleteFile(documentPath);
        } catch (cleanupError) {
          console.error(`Cleanup failed for orphaned agreement file with key: ${documentPath}`, cleanupError);
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

// 2. POST /api/agreement/:id/version - Create a new agreement version (requires unit ownership & active status on prior version)
router.post("/api/agreement/:id/version", verifyToken, requireRole("landlord"), upload.single("document"), async (req, res) => {
  try {
    const parentId = Number(req.params.id);
    const { rentAmount, securityDeposit, noticePeriodDays, startDate, endDate } = req.body;

    if (Number.isNaN(parentId)) {
      return res.status(400).json({ error: "Invalid agreement ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const parentAgreement = await prisma.agreement.findUnique({
      where: { id: parentId },
      include: {
        occupancy: {
          include: { unit: true },
        },
      },
    });

    if (!parentAgreement) {
      return res.status(404).json({ error: "Parent agreement not found" });
    }

    if (parentAgreement.occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    // Expiry check
    const effectiveParent = getEffectiveAgreement(parentAgreement);
    if (effectiveParent.status !== "ACTIVE" && effectiveParent.status !== "SUPERSEDED") {
      return res.status(400).json({ error: "New version can only be created from an ACTIVE or already SUPERSEDED agreement chain" });
    }

    let documentPath = null;
    if (req.file) {
      const pdfCheck = validatePdfFile(req.file);
      if (!pdfCheck.valid) {
        return res.status(400).json({ error: pdfCheck.error });
      }
      const uploadRes = await storageService.uploadFile(req.file, `agreements/${parentAgreement.occupancyId}`);
      documentPath = uploadRes.storageKey;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Fetch current max version safely under transaction
        const agg = await tx.agreement.findMany({
          where: { occupancyId: parentAgreement.occupancyId },
          orderBy: { version: "desc" },
          take: 1,
        });

        const nextVersion = (agg[0]?.version || 1) + 1;

        // Update old active ones to SUPERSEDED
        await tx.agreement.updateMany({
          where: { occupancyId: parentAgreement.occupancyId, status: "ACTIVE" },
          data: { status: "SUPERSEDED" },
        });

        const newAgg = await tx.agreement.create({
          data: {
            occupancyId: parentAgreement.occupancyId,
            version: nextVersion,
            status: "DRAFT",
            rentAmount: Number(rentAmount),
            securityDeposit: Number(securityDeposit),
            noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : 30,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            documentPath,
          },
        });

        return newAgg;
      });

      return res.status(201).json(result);
    } catch (dbError) {
      if (documentPath) {
        try {
          await storageService.deleteFile(documentPath);
        } catch (cleanupError) {
          console.error(`Cleanup failed for orphaned amended agreement file with key: ${documentPath}`, cleanupError);
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

// 3. PATCH /api/agreement/:id/submit - Submit terms to tenant
router.patch("/api/agreement/:id/submit", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: "Invalid agreement ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { occupancy: { include: { unit: true } } },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    if (agreement.occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    if (agreement.status !== "DRAFT") {
      return res.status(400).json({ error: "Agreement must be in DRAFT state to submit" });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: { status: "PENDING_TENANT" },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 4. PATCH /api/agreement/:id/sign-tenant - Student signing
router.patch("/api/agreement/:id/sign-tenant", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: "Invalid agreement ID" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });
    if (!student) {
      return res.status(403).json({ error: "Student profile not found" });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { occupancy: true },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    if (agreement.occupancy.studentId !== student.id) {
      return res.status(403).json({ error: "Forbidden: Not your occupancy agreement" });
    }

    if (agreement.status !== "PENDING_TENANT") {
      return res.status(400).json({ error: "Agreement is not pending tenant signature" });
    }

    // Idempotent check
    if (agreement.tenantSigned) {
      return res.json(agreement);
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        tenantSigned: true,
        tenantSignedAt: new Date(),
        status: "PENDING_LANDLORD",
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 5. PATCH /api/agreement/:id/sign-landlord - Landlord final signature activation
router.patch("/api/agreement/:id/sign-landlord", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: "Invalid agreement ID" });
    }

    const landlord = await prisma.landlord.findFirst({
      where: { userId: req.user.id },
    });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
      include: { occupancy: { include: { unit: true } } },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    if (agreement.occupancy.unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    if (agreement.status !== "PENDING_LANDLORD") {
      return res.status(400).json({ error: "Agreement is not pending landlord signature" });
    }

    // Idempotency: skip if already active
    if (agreement.landlordSigned && agreement.status === "ACTIVE") {
      return res.json(agreement);
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: {
        landlordSigned: true,
        landlordSignedAt: new Date(),
        status: "ACTIVE",
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 6. GET /api/student/agreements - Fetch student agreements
router.get("/api/student/agreements", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });
    if (!student) {
      return res.status(403).json({ error: "Student profile not found" });
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        occupancy: { studentId: student.id },
      },
      include: {
        occupancy: { include: { unit: true } },
      },
      orderBy: [{ occupancyId: "desc" }, { version: "desc" }],
    });

    // Apply deterministic status mapping on read
    const effective = agreements.map(getEffectiveAgreement);

    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 7. GET /api/parent/child-agreements - Scoped read-only parent check
router.get("/api/parent/child-agreements", verifyToken, requireRole("parent"), async (req, res) => {
  try {
    const parent = await prisma.parent.findFirst({
      where: { userId: req.user.id },
    });
    if (!parent) {
      return res.status(403).json({ error: "Parent profile not found" });
    }

    const activeLinks = await prisma.parentStudent.findMany({
      where: { parentId: parent.id, active: true, verified: true },
      select: { studentId: true },
    });

    const studentIds = activeLinks.map(l => l.studentId);
    if (studentIds.length === 0) {
      return res.json([]);
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        occupancy: {
          studentId: { in: studentIds },
        },
      },
      include: {
        occupancy: { include: { unit: true, student: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const effective = agreements.map(getEffectiveAgreement);
    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 8. GET /api/agreement/document/:id - Secure document streaming
router.get("/api/agreement/document/:id", verifyToken, async (req, res) => {
  try {
    const docId = Number(req.params.id);
    if (Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    if (req.query.compliance === "true") {
      const comp = await prisma.unitCompliance.findUnique({
        where: { id: docId },
        include: { unit: true },
      });

      if (!comp) {
        return res.status(404).json({ error: "Compliance document not found" });
      }

      let authorized = false;
      if (req.user.role === "admin") {
        authorized = true;
      } else if (req.user.role === "landlord") {
        const landlord = await prisma.landlord.findFirst({ where: { userId: req.user.id } });
        if (landlord && comp.unit.landlordId === landlord.id) {
          authorized = true;
        }
      }

      if (!authorized) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this document" });
      }

      const filePath = storageService.resolveStoragePath(comp.storageKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Document file not found on disk" });
      }

      res.setHeader("Content-Disposition", `inline; filename="${comp.fileName}"`);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: docId },
      include: {
        occupancy: {
          include: {
            unit: true,
            student: true,
          },
        },
      },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    if (!agreement.documentPath) {
      return res.status(404).json({ error: "No document attached to this agreement" });
    }

    // Scoped relationship checks
    let authorized = false;

    if (req.user.role === "admin") {
      authorized = true;
    } else if (req.user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({ where: { userId: req.user.id } });
      if (landlord && agreement.occupancy.unit.landlordId === landlord.id) {
        authorized = true;
      }
    } else if (req.user.role === "student") {
      const student = await prisma.student.findFirst({ where: { userId: req.user.id } });
      if (student && agreement.occupancy.studentId === student.id) {
        authorized = true;
      }
    } else if (req.user.role === "parent") {
      const parent = await prisma.parent.findFirst({ where: { userId: req.user.id } });
      if (parent) {
        const link = await prisma.parentStudent.findFirst({
          where: { parentId: parent.id, studentId: agreement.occupancy.studentId, active: true, verified: true },
        });
        if (link) authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this document" });
    }

    const filePath = storageService.resolveStoragePath(agreement.documentPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Document file not found on disk" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="agreement-${docId}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 9. POST /api/landlord/unit/:id/compliance - Upload unit compliance doc
router.post("/api/landlord/unit/:id/compliance", verifyToken, requireRole("landlord"), upload.single("document"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    const { docType, expiryDate } = req.body;

    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "Invalid unit ID" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Document file is required" });
    }

    const landlord = await prisma.landlord.findFirst({ where: { userId: req.user.id } });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const pdfCheck = validatePdfFile(req.file);
    if (!pdfCheck.valid) {
      return res.status(400).json({ error: pdfCheck.error });
    }

    const uploadRes = await storageService.uploadFile(req.file, `compliance/${unitId}`);
    const targetStorageKey = uploadRes.storageKey;

    try {
      const compliance = await prisma.$transaction(async (tx) => {
        const comp = await tx.unitCompliance.create({
          data: {
            unitId,
            docType: String(docType).trim(),
            storageKey: targetStorageKey,
            fileName: uploadRes.fileName,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            status: "PENDING",
          },
        });

        await tx.complianceAudit.create({
          data: {
            complianceId: comp.id,
            actorId: req.user.id,
            action: "SUBMIT",
            previousStatus: "PENDING",
            newStatus: "PENDING",
            reason: "Landlord document upload",
          },
        });

        return comp;
      });

      return res.status(201).json(compliance);
    } catch (dbError) {
      if (targetStorageKey) {
        try {
          await storageService.deleteFile(targetStorageKey);
        } catch (cleanupError) {
          console.error(`Cleanup failed for orphaned compliance file with key: ${targetStorageKey}`, cleanupError);
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Something went wrong" });
  }
});

// 10. GET /api/landlord/unit/:id/compliance - Fetch unit compliance docs
router.get("/api/landlord/unit/:id/compliance", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "Invalid unit ID" });
    }

    const landlord = await prisma.landlord.findFirst({ where: { userId: req.user.id } });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const compliances = await prisma.unitCompliance.findMany({
      where: { unitId },
      orderBy: { createdAt: "desc" },
    });

    const effective = compliances.map(getEffectiveCompliance);
    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 11. PATCH /api/admin/compliance/:id/verify - Verify compliance doc
router.patch("/api/admin/compliance/:id/verify", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const complianceId = Number(req.params.id);
    const { approve, reason } = req.body;

    if (Number.isNaN(complianceId)) {
      return res.status(400).json({ error: "Invalid compliance ID" });
    }

    const approveBool = approve === true || approve === "true";

    if (!approveBool && (!reason || String(reason).trim().length === 0)) {
      return res.status(400).json({ error: "A rejection reason is required for compliance disapproval" });
    }

    const comp = await prisma.unitCompliance.findUnique({
      where: { id: complianceId },
    });

    if (!comp) {
      return res.status(404).json({ error: "Compliance file not found" });
    }

    const newStatus = approveBool ? "APPROVED" : "REJECTED";

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.unitCompliance.update({
        where: { id: complianceId },
        data: { status: newStatus },
      });

      await tx.complianceAudit.create({
        data: {
          complianceId,
          actorId: req.user.id,
          action: approveBool ? "APPROVE" : "REJECT",
          previousStatus: comp.status,
          newStatus: newStatus,
          reason: reason ? String(reason).trim() : null,
        },
      });

      return updated;
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 12. GET /api/admin/compliance - Helper for admin verification page
router.get("/api/admin/compliance", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const compliances = await prisma.unitCompliance.findMany({
      include: {
        unit: {
          select: { id: true, landlordId: true },
        },
        audits: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const effective = compliances.map(getEffectiveCompliance);
    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 13. PATCH /api/admin/agreement/:id/terminate - Terminate agreement
router.patch("/api/admin/agreement/:id/terminate", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    const { reason } = req.body;

    if (Number.isNaN(agreementId)) {
      return res.status(400).json({ error: "Invalid agreement ID" });
    }

    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({ error: "A cancellation reason is required" });
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: agreementId },
    });

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    const updated = await prisma.agreement.update({
      where: { id: agreementId },
      data: { status: "TERMINATED" },
    });

    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// 14. GET /api/admin/agreements - Fetch all agreements for oversight
router.get("/api/admin/agreements", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const agreements = await prisma.agreement.findMany({
      include: {
        occupancy: {
          include: {
            student: { select: { id: true, name: true } },
            unit: { select: { id: true, landlordId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const effective = agreements.map(getEffectiveAgreement);
    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/landlord/unit/:id/agreements - Fetch agreements for owned unit
router.get("/api/landlord/unit/:id/agreements", verifyToken, requireRole("landlord"), async (req, res) => {
  try {
    const unitId = Number(req.params.id);
    if (Number.isNaN(unitId)) {
      return res.status(400).json({ error: "Invalid unit ID" });
    }

    const landlord = await prisma.landlord.findFirst({ where: { userId: req.user.id } });
    if (!landlord) {
      return res.status(403).json({ error: "Landlord profile not found" });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    if (unit.landlordId !== landlord.id) {
      return res.status(403).json({ error: "Forbidden: You do not own this unit" });
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        occupancy: { unitId },
      },
      include: {
        occupancy: {
          include: {
            student: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

    const effective = agreements.map(getEffectiveAgreement);
    return res.json(effective);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
