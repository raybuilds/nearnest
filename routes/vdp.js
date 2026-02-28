const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.post("/vdp", verifyToken, requireRole("student"), async (req, res) => {
  try {
    const { corridorId, intake, status } = req.body;

    if (!corridorId || !intake) {
      return res.status(400).json({ error: "corridorId and intake are required" });
    }

    const student = await prisma.student.findFirst({
      where: { userId: req.user.id },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const normalizedStatus = status ? String(status).trim() : "verified";
    if (!["registered", "verified", "shortlisted", "active"].includes(normalizedStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const existingEntry = await prisma.vDPEntry.findFirst({
      where: {
        studentId: student.id,
        corridorId: Number(corridorId),
        intake: String(intake).trim(),
      },
    });
    if (existingEntry) {
      return res.status(409).json({ error: "VDP entry already exists for this intake and corridor" });
    }

    const entry = await prisma.vDPEntry.create({
      data: {
        studentId: student.id,
        corridorId: Number(corridorId),
        intake: String(intake).trim(),
        verified: true,
        status: normalizedStatus,
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
