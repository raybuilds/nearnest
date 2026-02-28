const prisma = require("../prismaClient");
const { calculateTrustScore } = require("../engines/trustEngine");

async function recalculateUnitTrustScore(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { complaints: true },
  });

  if (!unit) {
    const error = new Error("Unit not found");
    error.statusCode = 404;
    throw error;
  }

  const trustScore = calculateTrustScore(unit);

  await prisma.unit.update({
    where: { id: unitId },
    data: { trustScore },
  });

  return trustScore;
}

module.exports = {
  recalculateUnitTrustScore,
};
