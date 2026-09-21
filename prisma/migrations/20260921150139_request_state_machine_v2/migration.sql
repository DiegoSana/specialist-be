-- Request state machine redesign (docs/EspecialistBRC — Estados del pedido.md).
--
-- The app is pre-launch (no real production data yet, per project decision), so instead of
-- mapping every old RequestStatus/RequestInterest row to a new value with a per-row CASE, we
-- wipe existing requests (and everything that cascades from them) and let prisma/seed.ts
-- recreate representative test data directly in the new states. This keeps the migration simple
-- and avoids ambiguous old->new mappings.
TRUNCATE TABLE "requests" CASCADE;

-- RequestStatus: recreate the enum with the new 15 values (main path + UNDER_REVIEW + 7 terminal
-- alternates). Table is empty at this point, so the type swap needs no per-row compatibility cast.
ALTER TABLE "requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
CREATE TYPE "RequestStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'SENT',
  'CONTACT_RELEASED',
  'IN_PROGRESS',
  'FINISHED',
  'CLOSED',
  'UNDER_REVIEW',
  'EXPIRED',
  'NO_RESPONSE',
  'REJECTED',
  'CANCELLED',
  'NOT_COMPLETED',
  'INTERRUPTED',
  'ABANDONED'
);
ALTER TABLE "requests" ALTER COLUMN "status" TYPE "RequestStatus" USING ("status"::text::"RequestStatus");
ALTER TABLE "requests" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "RequestStatus_old";

-- Reason given for NOT_COMPLETED / INTERRUPTED (and any future terminal state that needs one).
ALTER TABLE "requests" ADD COLUMN "statusReason" TEXT;

-- Per-interest sub-state for public ("bolsa") requests.
CREATE TYPE "RequestInterestStatus" AS ENUM ('INTERESTED', 'CHOSEN', 'NOT_CHOSEN', 'WITHDRAWN');
ALTER TABLE "request_interests" ADD COLUMN "status" "RequestInterestStatus" NOT NULL DEFAULT 'INTERESTED';
