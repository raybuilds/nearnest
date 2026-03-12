DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UnitStatus') THEN
    CREATE TYPE "UnitStatus" AS ENUM (
      'draft',
      'submitted',
      'admin_review',
      'approved',
      'suspended',
      'rejected',
      'archived'
    );
  END IF;
END $$;

ALTER TABLE "Unit"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Unit"
ALTER COLUMN "status" TYPE "UnitStatus"
USING ("status"::text::"UnitStatus");

ALTER TABLE "Unit"
ALTER COLUMN "status" SET DEFAULT 'draft';
