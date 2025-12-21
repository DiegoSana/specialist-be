export class ReviewEntity {
  static create(params: {
    id: string;
    reviewerId: string;
    professionalId: string;
    requestId: string | null;
    rating: number;
    comment: string | null;
    now?: Date;
  }): ReviewEntity {
    const now = params.now ?? new Date();
    return new ReviewEntity(
      params.id,
      params.reviewerId,
      params.professionalId,
      params.requestId,
      params.rating,
      params.comment,
      now,
      now,
    );
  }

  constructor(
    public readonly id: string,
    public readonly reviewerId: string,
    public readonly professionalId: string,
    public readonly requestId: string | null,
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isValidRating(): boolean {
    return this.rating >= 1 && this.rating <= 5;
  }

  withChanges(changes: {
    rating?: number;
    comment?: string | null;
    now?: Date;
  }): ReviewEntity {
    const now = changes.now ?? new Date();
    return new ReviewEntity(
      this.id,
      this.reviewerId,
      this.professionalId,
      this.requestId,
      changes.rating !== undefined ? changes.rating : this.rating,
      changes.comment !== undefined ? changes.comment : this.comment,
      this.createdAt,
      now,
    );
  }
}
