const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.post("/institutions", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { name, corridorId } = req.body;
    if (!name || !corridorId) {
      return res.status(400).json({ error: "name and corridorId are required" });
    }

    const corridor = await prisma.corridor.findUnique({
      where: { id: Number(corridorId) },
    });
    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    const institution = await prisma.institution.create({
      data: {
        name: String(name).trim(),
        corridorId: Number(corridorId),
      },
    });
    return res.status(201).json(institution);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/institutions/:corridorId", async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const institutions = await prisma.institution.findMany({
      where: { corridorId },
      orderBy: { name: "asc" },
    });
    return res.json(institutions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
