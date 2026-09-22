-- Fixes drift between prisma/schema.prisma and the migration history: these objects existed in the
-- schema (and in DBs built with `db push`) but no earlier migration created them, so a database
-- built only from migrations (fresh dev DB, CI) was missing them and `db:seed` failed.
-- Written idempotently so it is a no-op on databases that already have them (Fly/Supabase, local dev).

-- ReviewStatus enum
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- requests: rating of the client by the provider
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "clientRating" INTEGER;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "clientRatingComment" TEXT;

-- reviews: moderation fields
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderatedBy" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING';

-- Index that is no longer in the schema
DROP INDEX IF EXISTS "request_interests_serviceProviderId_idx";

-- Foreign keys as declared in the schema (reviews.requestId RESTRICT/CASCADE, reviews.moderatedBy SET NULL)
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_requestId_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_moderatedBy_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderatedBy_fkey" FOREIGN KEY ("moderatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
