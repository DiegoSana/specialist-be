-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "userId" TEXT,
    "relatedRequestId" TEXT,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "SupportMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "twilioMessageSid" TEXT,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_phoneNumber_key" ON "support_conversations"("phoneNumber");

-- CreateIndex
CREATE INDEX "support_conversations_status_updatedAt_idx" ON "support_conversations"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "support_conversations_userId_idx" ON "support_conversations"("userId");

-- CreateIndex
CREATE INDEX "support_conversations_relatedRequestId_idx" ON "support_conversations"("relatedRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_twilioMessageSid_key" ON "support_messages"("twilioMessageSid");

-- CreateIndex
CREATE INDEX "support_messages_conversationId_createdAt_idx" ON "support_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

