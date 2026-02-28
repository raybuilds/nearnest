const express = require("express");
const fs = require("fs");
const prisma = require("../prismaClient");
const { verifyToken } = require("../middlewares/auth");
const { resolveStoragePath } = require("../services/storageService");

const router = express.Router();

function isVisibleToStudents(unit) {
  return (
    unit.status === "approved" &&
    unit.structuralApproved &&
    unit.operationalBaselineApproved &&
    Number(unit.trustScore) >= 50
  );
}

router.get("/media/:id", verifyToken, async (req, res) => {
  try {
    const mediaId = Number(req.params.id);
    if (Number.isNaN(mediaId)) {
      return res.status(400).json({ error: "media id must be a number" });
    }

    const media = await prisma.unitMedia.findUnique({
      where: { id: mediaId },
      include: {
        unit: {
          select: {
            id: true,
            corridorId: true,
            landlordId: true,
            status: true,
            structuralApproved: true,
            operationalBaselineApproved: true,
            trustScore: true,
          },
        },
      },
    });

    if (!media || !media.unit) {
      return res.status(404).json({ error: "Media not found" });
    }

    if (req.user.role === "admin") {
      // allowed
    } else if (req.user.role === "landlord") {
      const landlord = await prisma.landlord.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!landlord || landlord.id !== media.unit.landlordId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (req.user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const vdp = await prisma.vDPEntry.findFirst({
        where: {
          studentId: student.id,
          corridorId: media.unit.corridorId,
          verified: true,
        },
      });

      if (!vdp || !isVisibleToStudents(media.unit)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (String(media.storageKey).startsWith("external:")) {
      const externalUrl = media.storageKey.slice("external:".length);
      return res.redirect(externalUrl);
    }

    const filePath = resolveStoragePath(media.storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Media file not found" });
    }

    res.setHeader("Content-Type", media.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${media.fileName}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
