const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.post("/student", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { name, intake, corridorId, userId, institutionId } = req.body;

    if (!name || !intake || !corridorId) {
      return res.status(400).json({ error: "name, intake and corridorId are required" });
    }

    const corridor = await prisma.corridor.findUnique({
      where: { id: Number(corridorId) },
    });

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    if (userId !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.role !== "student") {
        return res.status(400).json({ error: "User role must be student" });
      }
    }

    if (institutionId !== undefined && institutionId !== null) {
      const institution = await prisma.institution.findUnique({
        where: { id: Number(institutionId) },
      });
      if (!institution) {
        return res.status(404).json({ error: "Institution not found" });
      }
      if (institution.corridorId !== Number(corridorId)) {
        return res.status(400).json({ error: "Institution does not belong to the corridor" });
      }
    }

    const student = await prisma.student.create({
      data: {
        name: String(name).trim(),
        intake: String(intake).trim(),
        corridorId: Number(corridorId),
        userId: userId === undefined ? null : Number(userId),
        institutionId: institutionId === undefined || institutionId === null ? null : Number(institutionId),
      },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
