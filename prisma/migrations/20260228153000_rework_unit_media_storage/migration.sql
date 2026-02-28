-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('photo', 'document', 'walkthrough360');

-- AlterTable
ALTER TABLE "UnitMedia" RENAME COLUMN "url" TO "publicUrl";

ALTER TABLE "UnitMedia"
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "fileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "sizeInBytes" INTEGER,
ADD COLUMN "uploadedById" INTEGER,
ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;

-- Normalize media type text values into enum values
ALTER TABLE "UnitMedia"
ALTER COLUMN "type" TYPE "MediaType"
USING (
  CASE
    WHEN LOWER("type") = 'photo' THEN 'photo'::"MediaType"
    WHEN LOWER("type") = 'document' THEN 'document'::"MediaType"
    WHEN LOWER("type") IN ('360', 'walkthrough360') THEN 'walkthrough360'::"MediaType"
    ELSE 'document'::"MediaType"
  END
);

-- Backfill metadata for existing rows
UPDATE "UnitMedia" um
SET
  "storageKey" = COALESCE(NULLIF(um."publicUrl", ''), CONCAT('legacy/', um."id")),
  "fileName" = COALESCE(NULLIF(REGEXP_REPLACE(um."publicUrl", '^.*/', ''), ''), CONCAT('legacy-', um."id")),
  "mimeType" = CASE
    WHEN um."type" = 'photo'::"MediaType" THEN 'image/jpeg'
    WHEN um."type" = 'walkthrough360'::"MediaType" THEN 'text/html'
    ELSE 'application/octet-stream'
  END,
  "sizeInBytes" = 0,
  "uploadedById" = COALESCE(
    (
      SELECT l."userId"
      FROM "Unit" u
      LEFT JOIN "Landlord" l ON l."id" = u."landlordId"
      WHERE u."id" = um."unitId"
      LIMIT 1
    ),
    (SELECT u."id" FROM "User" u ORDER BY u."id" ASC LIMIT 1)
  );

ALTER TABLE "UnitMedia"
ALTER COLUMN "storageKey" SET NOT NULL,
ALTER COLUMN "publicUrl" SET NOT NULL,
ALTER COLUMN "fileName" SET NOT NULL,
ALTER COLUMN "mimeType" SET NOT NULL,
ALTER COLUMN "sizeInBytes" SET NOT NULL,
ALTER COLUMN "uploadedById" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "UnitMedia"
ADD CONSTRAINT "UnitMedia_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
