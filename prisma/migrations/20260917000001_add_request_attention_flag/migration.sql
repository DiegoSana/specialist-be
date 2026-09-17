-- CreateEnum
CREATE TYPE "RequestAttentionReason" AS ENUM ('AT_RISK', 'ABANDONED', 'ESCALATED');

-- CreateTable
CREATE TABLE "request_attention_flags" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reason" "RequestAttentionReason" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "request_attention_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_attention_flags_requestId_reason_resolvedAt_idx" ON "request_attention_flags"("requestId", "reason", "resolvedAt");

-- CreateIndex
CREATE INDEX "request_attention_flags_resolvedAt_idx" ON "request_attention_flags"("resolvedAt");

-- AddForeignKey
ALTER TABLE "request_attention_flags" ADD CONSTRAINT "request_attention_flags_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
