-- AlterTable
ALTER TABLE "Corridor"
ADD COLUMN "cityCode" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Occupant" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "cityCode" INTEGER NOT NULL,
    "corridorCode" INTEGER NOT NULL,
    "hostelCode" INTEGER NOT NULL,
    "roomNumber" INTEGER NOT NULL,
    "occupantIndex" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Occupant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Occupant_publicId_key" ON "Occupant"("publicId");

-- CreateIndex
CREATE INDEX "Occupant_studentId_active_idx" ON "Occupant"("studentId", "active");

-- CreateIndex
CREATE INDEX "Occupant_unitId_active_idx" ON "Occupant"("unitId", "active");

-- AddForeignKey
ALTER TABLE "Occupant" ADD CONSTRAINT "Occupant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupant" ADD CONSTRAINT "Occupant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
