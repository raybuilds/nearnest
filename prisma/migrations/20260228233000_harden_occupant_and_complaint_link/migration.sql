-- Add occupant lineage reference to complaints for immutable traceability.
ALTER TABLE "Complaint"
ADD COLUMN "occupantRecordId" INTEGER;

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_occupantRecordId_fkey"
FOREIGN KEY ("occupantRecordId") REFERENCES "Occupant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Prevent duplicate active slot assignment in the same room under concurrency.
CREATE UNIQUE INDEX "Occupant_unitId_roomNumber_occupantIndex_active_key"
ON "Occupant"("unitId", "roomNumber", "occupantIndex", "active");

-- Speed active-occupant lookup for capacity and slot assignment checks.
CREATE INDEX "Occupant_unitId_roomNumber_active_idx"
ON "Occupant"("unitId", "roomNumber", "active");
