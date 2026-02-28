const prisma = require("../prismaClient");

async function createCorridor(req, res, next) {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }

    const corridor = await prisma.corridor.create({
      data: { name: name.trim() },
    });

    res.status(201).json(corridor);
  } catch (error) {
    next(error);
  }
}

async function getCorridorOverview(req, res, next) {
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
    next(error);
  }
}

module.exports = {
  createCorridor,
  getCorridorOverview,
};
