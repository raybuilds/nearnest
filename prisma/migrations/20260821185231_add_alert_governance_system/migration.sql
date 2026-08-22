-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'READ', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "unitId" INTEGER,
    "occupancyId" INTEGER,
    "paymentId" INTEGER,
    "agreementId" INTEGER,
    "guestStayId" INTEGER,
    "complaintId" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_recipientId_status_idx" ON "Alert"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_recipientId_eventKey_key" ON "Alert"("recipientId", "eventKey");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
