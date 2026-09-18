-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('FOLLOW_UP', 'RESPONSE', 'STATUS_UPDATE');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'RESPONDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InteractionDirection" AS ENUM ('TO_CLIENT', 'TO_PROVIDER');

-- CreateEnum
CREATE TYPE "ResponseIntent" AS ENUM ('CONFIRMED', 'STARTED', 'COMPLETED', 'CANCELLED', 'NEEDS_INFO', 'UNKNOWN');

-- CreateTable
CREATE TABLE "request_interactions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "interactionType" "InteractionType" NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'PENDING',
    "direction" "InteractionDirection" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "messageTemplate" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "responseContent" TEXT,
    "responseIntent" "ResponseIntent",
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "twilioMessageSid" TEXT,
    "twilioStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_interactions_requestId_createdAt_idx" ON "request_interactions"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "request_interactions_status_scheduledFor_idx" ON "request_interactions"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "request_interactions_twilioMessageSid_key" ON "request_interactions"("twilioMessageSid");

-- CreateIndex
CREATE INDEX "request_interactions_twilioMessageSid_idx" ON "request_interactions"("twilioMessageSid");

-- AddForeignKey
ALTER TABLE "request_interactions" ADD CONSTRAINT "request_interactions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

