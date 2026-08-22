-- CreateTable
CREATE TABLE "GuestStay" (
    "id" SERIAL NOT NULL,
    "guestName" TEXT NOT NULL,
    "occupancyId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestStay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestStay_occupancyId_idx" ON "GuestStay"("occupancyId");

-- CreateIndex
CREATE INDEX "GuestStay_active_idx" ON "GuestStay"("active");

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
