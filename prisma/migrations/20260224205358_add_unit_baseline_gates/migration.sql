-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "operationalBaselineApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "structuralApproved" BOOLEAN NOT NULL DEFAULT false;
