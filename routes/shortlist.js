const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.post("/shortlist", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const { unitId } = req.body;
    if (!unitId) {
      return res.status(400).json({ error: "unitId is required" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(403).json({ error: "Student profile not found" });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: Number(unitId) },
      select: { id: true, corridorId: true },
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
      orderBy: { joinedAt: "desc" },
    });
    if (!vdpEntry) {
      return res.status(403).json({ error: "Not in verified demand pool" });
    }

    const existingShortlist = await prisma.shortlist.findFirst({
      where: {
        studentId: student.id,
        unitId: unit.id,
      },
    });
    if (existingShortlist) {
      return res.status(200).json(existingShortlist);
    }

    const shortlist = await prisma.shortlist.create({
      data: {
        studentId: student.id,
        unitId: unit.id,
      },
    });

    if (vdpEntry.status === "registered" || vdpEntry.status === "verified") {
      await prisma.vDPEntry.update({
        where: { id: vdpEntry.id },
        data: { status: "shortlisted" },
      });
    }

    return res.status(201).json(shortlist);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
