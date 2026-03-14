const prisma = require("../prismaClient");
const { calculateTrustScore } = require("./intelligence/trustEngine");
const governanceEvents = require("./governanceEvents");

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

  governanceEvents.emit("TRUST_SCORE_UPDATED", {
    unitId,
    trustScore,
  });

  return trustScore;
}

module.exports = {
  recalculateUnitTrustScore,
};
