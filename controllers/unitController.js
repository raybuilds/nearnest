const prisma = require("../prismaClient");

async function createUnit(req, res, next) {
  try {
    const { corridorId } = req.body;

    if (!corridorId) {
      return res.status(400).json({ error: "corridorId is required" });
    }

    const corridor = await prisma.corridor.findUnique({ where: { id: Number(corridorId) } });

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    const unit = await prisma.unit.create({
      data: { corridorId: Number(corridorId) },
    });

    res.status(201).json(unit);
  } catch (error) {
    next(error);
  }
}

async function getVisibleUnitsByCorridor(req, res, next) {
  try {
    const corridorId = Number(req.params.corridorId);

    if (Number.isNaN(corridorId)) {
      return res.status(400).json({ error: "corridorId must be a number" });
    }

    const units = await prisma.unit.findMany({
      where: {
        corridorId,
        trustScore: { gte: 50 },
      },
      orderBy: { trustScore: "desc" },
    });

    res.json(units);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUnit,
  getVisibleUnitsByCorridor,
};
