import { RequestInterestStatus } from '@prisma/client';

export type RequestInterestProviderInfo = {
  id: string;
  type: 'PROFESSIONAL' | 'COMPANY';
  displayName: string;
  profileImage: string | null;
  averageRating: number;
  totalReviews: number;
  whatsapp: string | null;
  phone: string | null;
};

export class RequestInterestEntity {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly serviceProviderId: string,
    public readonly message: string | null,
    public readonly createdAt: Date,
    public readonly status: RequestInterestStatus = RequestInterestStatus.INTERESTED,
    // Optional: attached provider info for display
    public readonly provider?: RequestInterestProviderInfo,
  ) {}

  /**
   * @deprecated Use serviceProviderId instead
   */
  get professionalId(): string {
    return this.serviceProviderId;
  }

  isInterested(): boolean {
    return this.status === RequestInterestStatus.INTERESTED;
  }

  isChosen(): boolean {
    return this.status === RequestInterestStatus.CHOSEN;
  }

  isNotChosen(): boolean {
    return this.status === RequestInterestStatus.NOT_CHOSEN;
  }

  isWithdrawn(): boolean {
    return this.status === RequestInterestStatus.WITHDRAWN;
  }

  /** Only the provider who owns the interest can withdraw it, and only while it is undecided. */
  canBeWithdrawnBy(ctx: { serviceProviderId?: string | null }): boolean {
    return (
      this.isInterested() &&
      !!ctx.serviceProviderId &&
      ctx.serviceProviderId === this.serviceProviderId
    );
  }

  markChosen(): RequestInterestEntity {
    return this.withStatus(RequestInterestStatus.CHOSEN);
  }

  markNotChosen(): RequestInterestEntity {
    return this.withStatus(RequestInterestStatus.NOT_CHOSEN);
  }

  withdraw(): RequestInterestEntity {
    return this.withStatus(RequestInterestStatus.WITHDRAWN);
  }

  /** Provider expresses interest again after having withdrawn (reuses the row). */
  reExpress(message: string | null): RequestInterestEntity {
    return this.withStatus(RequestInterestStatus.INTERESTED, message);
  }

  /** Back to undecided, used when the client's choice is reverted. */
  reset(): RequestInterestEntity {
    return this.withStatus(RequestInterestStatus.INTERESTED);
  }

  private withStatus(
    status: RequestInterestStatus,
    message: string | null = this.message,
  ): RequestInterestEntity {
    return new RequestInterestEntity(
      this.id,
      this.requestId,
      this.serviceProviderId,
      message,
      this.createdAt,
      status,
      this.provider,
    );
  }
}
