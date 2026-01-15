-- =====================================================
-- Migration: Decouple RequestInterest from Professional
-- Links RequestInterest to ServiceProvider instead
-- =====================================================

-- Step 1: Add the new serviceProviderId column (nullable initially)
ALTER TABLE "request_interests" ADD COLUMN "serviceProviderId" TEXT;

-- Step 2: Migrate existing data - get serviceProviderId from professionals
UPDATE "request_interests" ri
SET "serviceProviderId" = p."serviceProviderId"
FROM "professionals" p
WHERE ri."professionalId" = p.id;

-- Step 3: Make serviceProviderId NOT NULL now that data is migrated
ALTER TABLE "request_interests" ALTER COLUMN "serviceProviderId" SET NOT NULL;

-- Step 4: Drop the old unique constraint
ALTER TABLE "request_interests" DROP CONSTRAINT IF EXISTS "request_interests_requestId_professionalId_key";

-- Step 5: Drop the old foreign key constraint
ALTER TABLE "request_interests" DROP CONSTRAINT IF EXISTS "request_interests_professionalId_fkey";

-- Step 6: Drop the old professionalId column
ALTER TABLE "request_interests" DROP COLUMN "professionalId";

-- Step 7: Add new foreign key to service_providers
ALTER TABLE "request_interests" ADD CONSTRAINT "request_interests_serviceProviderId_fkey" 
  FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Add new unique constraint
ALTER TABLE "request_interests" ADD CONSTRAINT "request_interests_requestId_serviceProviderId_key" 
  UNIQUE ("requestId", "serviceProviderId");

-- Step 9: Create index for performance
CREATE INDEX IF NOT EXISTS "request_interests_serviceProviderId_idx" ON "request_interests"("serviceProviderId");

