import { RequestAttentionReason } from '@prisma/client';

/**
 * A flag marking a request as needing admin attention (at risk of being abandoned,
 * actually abandoned per the classifier, or explicitly escalated by a WhatsApp reply).
 * Association-store style, like RequestInterest — not a rich aggregate.
 */
export class RequestAttentionFlagEntity {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly reason: RequestAttentionReason,
    public readonly detail: string | null,
    public readonly createdAt: Date,
    public readonly resolvedAt: Date | null,
    public readonly resolvedByUserId: string | null,
  ) {}

  isOpen(): boolean {
    return this.resolvedAt === null;
  }
}
