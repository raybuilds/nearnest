-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "incidentFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "incidentType" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "bedAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "falseDeclarationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "institutionProximityKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "toiletsAvailable" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ventilationGood" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "waterAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "StructuralChecklist" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "fireExit" BOOLEAN NOT NULL DEFAULT false,
    "wiringSafe" BOOLEAN NOT NULL DEFAULT false,
    "plumbingSafe" BOOLEAN NOT NULL DEFAULT false,
    "occupancyCompliant" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StructuralChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalChecklist" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "bedAvailable" BOOLEAN NOT NULL DEFAULT false,
    "waterAvailable" BOOLEAN NOT NULL DEFAULT false,
    "toiletsAvailable" BOOLEAN NOT NULL DEFAULT false,
    "ventilationGood" BOOLEAN NOT NULL DEFAULT false,
    "selfDeclaration" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OperationalChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitMedia" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "reason" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "correctiveDeadline" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StructuralChecklist_unitId_key" ON "StructuralChecklist"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalChecklist_unitId_key" ON "OperationalChecklist"("unitId");

-- AddForeignKey
ALTER TABLE "StructuralChecklist" ADD CONSTRAINT "StructuralChecklist_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalChecklist" ADD CONSTRAINT "OperationalChecklist_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMedia" ADD CONSTRAINT "UnitMedia_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
