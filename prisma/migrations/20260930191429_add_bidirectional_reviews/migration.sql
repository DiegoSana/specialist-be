-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('CLIENT_TO_PROVIDER', 'PROVIDER_TO_CLIENT');

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_requestId_fkey";

-- DropIndex
DROP INDEX "reviews_requestId_key";

-- AlterTable: revieweeUserId starts nullable so existing rows can be backfilled below, then gets
-- NOT NULL once every row has a value (hand-written instead of prisma-generated: a plain "ADD
-- COLUMN ... NOT NULL" would fail against the 11 pre-existing rows, see docs/guides/MIGRATION_GUIDE.md).
ALTER TABLE "reviews" ADD COLUMN     "direction" "ReviewDirection" NOT NULL DEFAULT 'CLIENT_TO_PROVIDER',
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revealedAt" TIMESTAMP(3),
ADD COLUMN     "revieweeUserId" TEXT,
ALTER COLUMN "serviceProviderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "clientAverageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "clientTotalReviews" INTEGER NOT NULL DEFAULT 0;

-- Data migration 1/3: backfill revieweeUserId for existing (pre-redesign) reviews, all of which
-- are CLIENT_TO_PROVIDER (the DEFAULT just applied) — the reviewee is the reviewed provider's own
-- user (Professional or Company owner).
UPDATE "reviews" r
SET "revieweeUserId" = COALESCE(prof."userId", comp."userId")
FROM "service_providers" sp
LEFT JOIN "professionals" prof ON prof."serviceProviderId" = sp.id
LEFT JOIN "companies" comp ON comp."serviceProviderId" = sp.id
WHERE sp.id = r."serviceProviderId"
  AND r."revieweeUserId" IS NULL;

-- Now safe to enforce NOT NULL: every pre-existing review has a provider with a Professional or
-- Company (ReviewService.create always required request.providerId to be set to create a review).
ALTER TABLE "reviews" ALTER COLUMN "revieweeUserId" SET NOT NULL;

-- Data migration 2/3 (REVIEWS_REDESIGN.md section 4.1, "decision tomada" section 2: backfill
-- legacy as APPROVED): migrate Request.clientRating/clientRatingComment into PROVIDER_TO_CLIENT
-- reviews. status APPROVED (they were already effectively visible under the old asymmetric model,
-- with no moderation step to have gone through), revealedAt = Request.updatedAt as the closest
-- available approximation of "when the flat fields were last written" (createdAt would be the
-- request's creation time, not the rating time; Request has no separate "ratedAt" column).
-- Request.clientRating/clientRatingComment columns are left in place for read compat; no code
-- path writes them anymore after this migration (see RequestService.rateClient).
INSERT INTO "reviews" (
  "id", "direction", "reviewerId", "revieweeUserId", "serviceProviderId", "requestId",
  "rating", "comment", "status", "revealedAt", "moderatedBy", "moderatedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'PROVIDER_TO_CLIENT',
  COALESCE(prof."userId", comp."userId"),
  req."clientId",
  sp.id,
  req.id,
  req."clientRating",
  req."clientRatingComment",
  'APPROVED',
  req."updatedAt",
  NULL,
  NULL,
  req."updatedAt",
  req."updatedAt"
FROM "requests" req
JOIN "service_providers" sp ON sp.id = req."providerId"
LEFT JOIN "professionals" prof ON prof."serviceProviderId" = sp.id
LEFT JOIN "companies" comp ON comp."serviceProviderId" = sp.id
WHERE req."clientRating" IS NOT NULL
  AND COALESCE(prof."userId", comp."userId") IS NOT NULL
  -- Idempotency guard in case this migration is ever re-run against a DB that already has the
  -- backfilled rows (e.g. a partially-applied deploy retried).
  AND NOT EXISTS (
    SELECT 1 FROM "reviews" rv
    WHERE rv."requestId" = req.id AND rv."direction" = 'PROVIDER_TO_CLIENT'
  );

-- Data migration 3/3: recompute User.clientAverageRating/clientTotalReviews from the
-- PROVIDER_TO_CLIENT reviews just backfilled (mirrors ReviewService.updateServiceProviderRating's
-- recomputation-from-APPROVED-reviews approach, done here once in SQL for the historical backlog
-- instead of looping in application code).
UPDATE "users" u
SET "clientAverageRating" = agg.avg_rating,
    "clientTotalReviews" = agg.total
FROM (
  SELECT "revieweeUserId" AS user_id, AVG("rating"::float) AS avg_rating, COUNT(*) AS total
  FROM "reviews"
  WHERE "direction" = 'PROVIDER_TO_CLIENT' AND "status" = 'APPROVED'
  GROUP BY "revieweeUserId"
) agg
WHERE u.id = agg.user_id;

-- CreateIndex
CREATE UNIQUE INDEX "reviews_requestId_direction_key" ON "reviews"("requestId", "direction");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_revieweeUserId_fkey" FOREIGN KEY ("revieweeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
