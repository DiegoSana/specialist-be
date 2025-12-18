import { RequestStatus } from '@prisma/client';

export class RequestEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly professionalId: string | null,
    public readonly tradeId: string | null,
    public readonly isPublic: boolean,
    public readonly description: string,
    public readonly address: string | null,
    public readonly availability: string | null,
    public readonly photos: string[],
    public readonly status: RequestStatus,
    public readonly quoteAmount: number | null,
    public readonly quoteNotes: string | null,
    public readonly clientRating: number | null,
    public readonly clientRatingComment: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isPending(): boolean {
    return this.status === RequestStatus.PENDING;
  }

  isAccepted(): boolean {
    return this.status === RequestStatus.ACCEPTED;
  }

  isInProgress(): boolean {
    return this.status === RequestStatus.IN_PROGRESS;
  }

  isDone(): boolean {
    return this.status === RequestStatus.DONE;
  }

  isCancelled(): boolean {
    return this.status === RequestStatus.CANCELLED;
  }

  canBeReviewed(): boolean {
    return this.isDone();
  }

  isPublicRequest(): boolean {
    return this.isPublic;
  }
}
