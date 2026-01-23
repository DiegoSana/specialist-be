export class RequestInterestEntity {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly serviceProviderId: string,
    public readonly message: string | null,
    public readonly createdAt: Date,
      // Optional: attached provider info for display
      public readonly provider?: {
        id: string;
        type: 'PROFESSIONAL' | 'COMPANY';
        displayName: string;
        profileImage: string | null;
        averageRating: number;
        totalReviews: number;
        whatsapp: string | null;
        phone: string | null;
      },
  ) {}

  /**
   * @deprecated Use serviceProviderId instead
   */
  get professionalId(): string {
    return this.serviceProviderId;
  }
}
