-- AlterTable
ALTER TABLE "notification_deliveries"
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "notification_deliveries_channel_status_idx";

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_nextAttemptAt_idx" ON "notification_deliveries"("channel", "status", "nextAttemptAt");

