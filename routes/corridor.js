const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

async function buildCorridorDemandMetrics(corridorId) {
  const corridor = await prisma.corridor.findUnique({
    where: { id: corridorId },
  });
  if (!corridor) {
    return null;
  }

  const [vdpEntries, shortlistCount, units] = await Promise.all([
    prisma.vDPEntry.findMany({
      where: {
        corridorId,
        verified: true,
      },
      include: {
        student: {
          select: {
            institution: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.shortlist.count({
      where: {
        unit: {
          corridorId,
        },
      },
    }),
    prisma.unit.findMany({
      where: { corridorId },
      select: {
        id: true,
        capacity: true,
        occupancies: {
          where: { endDate: null },
          select: { id: true },
        },
      },
    }),
  ]);

  const byInstitutionMap = new Map();
  const byIntakeMap = new Map();

  vdpEntries.forEach((entry) => {
    const institutionId = entry.student?.institution?.id || "unknown";
    const institutionName = entry.student?.institution?.name || "Unknown";
    if (!byInstitutionMap.has(institutionId)) {
      byInstitutionMap.set(institutionId, { institutionId, institutionName, count: 0 });
    }
    byInstitutionMap.get(institutionId).count += 1;

    const intake = entry.intake || "unknown";
    if (!byIntakeMap.has(intake)) {
      byIntakeMap.set(intake, { intake, count: 0 });
    }
    byIntakeMap.get(intake).count += 1;
  });

  const totalCapacity = units.reduce((sum, unit) => sum + (unit.capacity || 0), 0);
  const totalActiveOccupancies = units.reduce((sum, unit) => sum + unit.occupancies.length, 0);
  const occupancyRatio = totalCapacity === 0 ? 0 : Number((totalActiveOccupancies / totalCapacity).toFixed(4));

  return {
    corridorId,
    totalVdpStudents: vdpEntries.length,
    byInstitution: Array.from(byInstitutionMap.values()).sort((a, b) => b.count - a.count),
    byIntake: Array.from(byIntakeMap.values()).sort((a, b) => b.count - a.count),
    shortlistCount,
    occupancy: {
      totalCapacity,
      totalActiveOccupancies,
      occupancyRatio,
    },
  };
}

router.get("/corridors", async (req, res) => {
  try {
    const corridors = await prisma.corridor.findMany({
      orderBy: { id: "asc" },
    });
    res.json(corridors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/corridor", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { name, cityCode } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }

    let parsedCityCode = 0;
    if (cityCode !== undefined && cityCode !== null && String(cityCode).trim() !== "") {
      parsedCityCode = Number(cityCode);
      if (!Number.isInteger(parsedCityCode) || parsedCityCode < 0 || parsedCityCode > 99) {
        return res.status(400).json({ error: "cityCode must be an integer from 0 to 99" });
      }
    }

    const corridor = await prisma.corridor.create({
      data: { name: name.trim(), cityCode: parsedCityCode },
    });

    res.status(201).json(corridor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/corridor/:corridorId/overview", async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);

    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const [corridor, allUnits, visibleUnits] = await Promise.all([
      prisma.corridor.findUnique({ where: { id: corridorId } }),
      prisma.unit.findMany({ where: { corridorId }, select: { id: true, trustScore: true } }),
      prisma.unit.findMany({
        where: {
          corridorId,
          status: "approved",
          structuralApproved: true,
          operationalBaselineApproved: true,
          trustScore: { gte: 50 },
        },
        orderBy: { trustScore: "desc" },
      }),
    ]);

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    const averageTrustScore =
      allUnits.length === 0
        ? 0
        : Number((allUnits.reduce((sum, unit) => sum + unit.trustScore, 0) / allUnits.length).toFixed(2));

    res.json({
      corridor,
      stats: {
        totalUnits: allUnits.length,
        visibleUnits: visibleUnits.length,
        hiddenUnits: allUnits.length - visibleUnits.length,
        averageTrustScore,
      },
      visibleUnits,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/corridor/:corridorId/demand", verifyToken, async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const payload = await buildCorridorDemandMetrics(corridorId);
    if (!payload) {
      return res.status(404).json({ error: "Corridor not found" });
    }
    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/corridor/:corridorId/demand", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const corridorId = Number(req.params.corridorId);
    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const payload = await buildCorridorDemandMetrics(corridorId);
    if (!payload) {
      return res.status(404).json({ error: "Corridor not found" });
    }
    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
