-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "institutionId" INTEGER;
-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1;
-- CreateTable
CREATE TABLE "Institution" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "corridorId" INTEGER NOT NULL,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Occupancy" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);
-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "Corridor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
