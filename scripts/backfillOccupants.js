const prisma = require("../prismaClient");
const { generateOccupantId } = require("../services/occupantIdService");

const MAX_ENCODED_SLOTS = 9;
const MAX_RETRIES = 3;

async function backfillOne(occupancy) {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.occupant.findFirst({
          where: {
            unitId: occupancy.unitId,
            studentId: occupancy.studentId,
            active: true,
          },
          select: { id: true, publicId: true },
        });
        if (existing) {
          return { status: "exists", publicId: existing.publicId };
        }

        await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${occupancy.unitId} FOR UPDATE`;

        const unit = await tx.unit.findUnique({
          where: { id: occupancy.unitId },
          include: {
            corridor: { select: { id: true, cityCode: true } },
          },
        });
        if (!unit) {
          return { status: "skipped", reason: "unit_not_found" };
        }

        const maxAllowedCapacity = Math.min(unit.capacity, MAX_ENCODED_SLOTS);
        if (maxAllowedCapacity <= 0) {
          return { status: "skipped", reason: "invalid_capacity" };
        }

        const cityCode = Number(unit.corridor?.cityCode || 0);
        const corridorCode = Number(unit.corridorId);
        const hostelCode = Number(unit.id);
        const roomNumber = Number(unit.id);

        const existingActive = await tx.occupant.findMany({
          where: {
            unitId: occupancy.unitId,
            roomNumber,
            active: true,
          },
          select: { occupantIndex: true },
        });

        const usedIndices = new Set(existingActive.map((item) => item.occupantIndex));
        let occupantIndex = 1;
        while (usedIndices.has(occupantIndex) && occupantIndex <= maxAllowedCapacity) {
          occupantIndex += 1;
        }
        if (occupantIndex > maxAllowedCapacity) {
          return { status: "skipped", reason: "no_slot_available" };
        }

        const publicId = generateOccupantId({
          cityCode,
          corridorCode,
          hostelCode,
          roomNumber,
          occupantIndex,
        });

        await tx.occupant.create({
          data: {
            publicId,
            cityCode,
            corridorCode,
            hostelCode,
            roomNumber,
            occupantIndex,
            studentId: occupancy.studentId,
            unitId: occupancy.unitId,
            active: true,
            createdAt: occupancy.startDate || new Date(),
          },
        });

        return { status: "created", publicId };
      });
      return created;
    } catch (error) {
      if (error?.code === "P2002") {
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  return { status: "skipped", reason: "conflict_retry_exhausted" };
}

async function main() {
  const activeOccupancies = await prisma.occupancy.findMany({
    where: { endDate: null },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      unitId: true,
      studentId: true,
      startDate: true,
    },
  });

  const summary = {
    scanned: activeOccupancies.length,
    created: 0,
    exists: 0,
    skipped: 0,
    skippedReasons: {},
  };

  for (const occupancy of activeOccupancies) {
    const result = await backfillOne(occupancy);
    if (result.status === "created") {
      summary.created += 1;
      continue;
    }
    if (result.status === "exists") {
      summary.exists += 1;
      continue;
    }
    summary.skipped += 1;
    const reason = result.reason || "unknown";
    summary.skippedReasons[reason] = (summary.skippedReasons[reason] || 0) + 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
