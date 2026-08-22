-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PENDING_TENANT', 'PENDING_LANDLORD', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Agreement" (
    "id" SERIAL NOT NULL,
    "occupancyId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "rentAmount" INTEGER NOT NULL,
    "securityDeposit" INTEGER NOT NULL,
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 30,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "documentPath" TEXT,
    "tenantSigned" BOOLEAN NOT NULL DEFAULT false,
    "tenantSignedAt" TIMESTAMP(3),
    "landlordSigned" BOOLEAN NOT NULL DEFAULT false,
    "landlordSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitCompliance" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAudit" (
    "id" SERIAL NOT NULL,
    "complianceId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" "ComplianceStatus" NOT NULL,
    "newStatus" "ComplianceStatus" NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agreement_occupancyId_idx" ON "Agreement"("occupancyId");

-- CreateIndex
CREATE INDEX "Agreement_status_idx" ON "Agreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_occupancyId_version_key" ON "Agreement"("occupancyId", "version");

-- CreateIndex
CREATE INDEX "UnitCompliance_unitId_idx" ON "UnitCompliance"("unitId");

-- CreateIndex
CREATE INDEX "UnitCompliance_status_idx" ON "UnitCompliance"("status");

-- CreateIndex
CREATE INDEX "ComplianceAudit_complianceId_idx" ON "ComplianceAudit"("complianceId");

-- CreateIndex
CREATE INDEX "ComplianceAudit_actorId_idx" ON "ComplianceAudit"("actorId");

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCompliance" ADD CONSTRAINT "UnitCompliance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAudit" ADD CONSTRAINT "ComplianceAudit_complianceId_fkey" FOREIGN KEY ("complianceId") REFERENCES "UnitCompliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
