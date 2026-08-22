-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'VERIFIED');

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "occupancyId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "receiptRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAudit" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_occupancyId_idx" ON "Payment"("occupancyId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_occupancyId_month_key" ON "Payment"("occupancyId", "month");

-- CreateIndex
CREATE INDEX "PaymentAudit_paymentId_idx" ON "PaymentAudit"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAudit_actorId_idx" ON "PaymentAudit"("actorId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
