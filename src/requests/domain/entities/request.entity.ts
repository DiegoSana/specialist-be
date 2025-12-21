import { RequestStatus } from '@prisma/client';

export class RequestEntity {
  static createPending(params: {
    id: string;
    clientId: string;
    professionalId: string | null;
    tradeId: string | null;
    isPublic: boolean;
    description: string;
    address: string | null;
    availability: string | null;
    photos?: string[];
    now?: Date;
  }): RequestEntity {
    const now = params.now ?? new Date();
    return new RequestEntity(
      params.id,
      params.clientId,
      params.professionalId,
      params.tradeId,
      params.isPublic,
      params.description,
      params.address,
      params.availability,
      params.photos ?? [],
      RequestStatus.PENDING,
      null,
      null,
      null,
      null,
      now,
      now,
    );
  }

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

  withChanges(changes: {
    professionalId?: string | null;
    tradeId?: string | null;
    isPublic?: boolean;
    description?: string;
    address?: string | null;
    availability?: string | null;
    photos?: string[];
    status?: RequestStatus;
    quoteAmount?: number | null;
    quoteNotes?: string | null;
    clientRating?: number | null;
    clientRatingComment?: string | null;
    now?: Date;
  }): RequestEntity {
    const now = changes.now ?? new Date();
    return new RequestEntity(
      this.id,
      this.clientId,
      changes.professionalId !== undefined
        ? changes.professionalId
        : this.professionalId,
      changes.tradeId !== undefined ? changes.tradeId : this.tradeId,
      changes.isPublic !== undefined ? changes.isPublic : this.isPublic,
      changes.description !== undefined
        ? changes.description
        : this.description,
      changes.address !== undefined ? changes.address : this.address,
      changes.availability !== undefined
        ? changes.availability
        : this.availability,
      changes.photos !== undefined ? changes.photos : this.photos,
      changes.status !== undefined ? changes.status : this.status,
      changes.quoteAmount !== undefined
        ? changes.quoteAmount
        : this.quoteAmount,
      changes.quoteNotes !== undefined ? changes.quoteNotes : this.quoteNotes,
      changes.clientRating !== undefined
        ? changes.clientRating
        : this.clientRating,
      changes.clientRatingComment !== undefined
        ? changes.clientRatingComment
        : this.clientRatingComment,
      this.createdAt,
      now,
    );
  }
}
