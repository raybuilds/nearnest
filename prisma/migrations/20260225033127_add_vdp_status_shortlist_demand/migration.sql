-- AlterTable
ALTER TABLE "VDPEntry" ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'verified';
-- CreateTable
CREATE TABLE "Shortlist" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);
-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
