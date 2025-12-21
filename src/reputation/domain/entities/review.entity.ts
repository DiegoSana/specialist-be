export class ReviewEntity {
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
}
