const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const EXPECTED = {
  totalUnits: 7,
  suspendedUnits: 2,
  nearThresholdUnits: 3,
  healthyUnits: 3,
  openAudits: 2,
  resolvedAudits: 2,
};

async function main() {
  const [
    totalUnits,
    suspendedUnits,
    nearThresholdUnits,
    healthyUnits,
    openAudits,
    resolvedAudits,
  ] = await Promise.all([
    prisma.unit.count(),
    prisma.unit.count({ where: { status: "suspended" } }),
    prisma.unit.count({
      where: {
        trustScore: {
          gte: 50,
          lte: 65,
        },
      },
    }),
    prisma.unit.count({
      where: {
        status: "approved",
        structuralApproved: true,
        operationalBaselineApproved: true,
        trustScore: {
          gte: 70,
        },
      },
    }),
    prisma.auditLog.count({ where: { resolved: false } }),
    prisma.auditLog.count({ where: { resolved: true } }),
  ]);

  const actual = {
    totalUnits,
    suspendedUnits,
    nearThresholdUnits,
    healthyUnits,
    openAudits,
    resolvedAudits,
  };

  const mismatches = Object.keys(EXPECTED).filter((key) => actual[key] !== EXPECTED[key]);
  if (mismatches.length > 0) {
    const details = mismatches
      .map((key) => `${key}: expected ${EXPECTED[key]}, got ${actual[key]}`)
      .join("\n");
    throw new Error(`Demo validation failed:\n${details}`);
  }

  console.log("Demo state validation passed.");
  console.log(actual);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

