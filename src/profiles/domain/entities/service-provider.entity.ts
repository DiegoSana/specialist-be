/**
 * Types of service providers
 */
export enum ProviderType {
  PROFESSIONAL = 'PROFESSIONAL',
  COMPANY = 'COMPANY',
}

/**
 * ServiceProvider is the abstract base entity for both Professional and Company.
 * It holds common data like ratings and reviews count, and allows Request and Review
 * to work polymorphically with either type.
 */
export class ServiceProviderEntity {
  constructor(
    public readonly id: string,
    public readonly type: ProviderType,
    public readonly averageRating: number,
    public readonly totalReviews: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Factory method to create a new ServiceProvider for a Professional
   */
  static createForProfessional(id: string, now?: Date): ServiceProviderEntity {
    const timestamp = now ?? new Date();
    return new ServiceProviderEntity(
      id,
      ProviderType.PROFESSIONAL,
      0,
      0,
      timestamp,
      timestamp,
    );
  }

  /**
   * Factory method to create a new ServiceProvider for a Company
   */
  static createForCompany(id: string, now?: Date): ServiceProviderEntity {
    const timestamp = now ?? new Date();
    return new ServiceProviderEntity(
      id,
      ProviderType.COMPANY,
      0,
      0,
      timestamp,
      timestamp,
    );
  }

  /**
   * Check if this is a professional provider
   */
  isProfessional(): boolean {
    return this.type === ProviderType.PROFESSIONAL;
  }

  /**
   * Check if this is a company provider
   */
  isCompany(): boolean {
    return this.type === ProviderType.COMPANY;
  }

  /**
   * Check if the provider can receive requests
   */
  canReceiveRequests(): boolean {
    // Both types can receive requests
    return true;
  }

  /**
   * Check if the provider can be reviewed
   */
  canBeReviewed(): boolean {
    // Both types can be reviewed
    return true;
  }

  /**
   * Calculate new average rating after a new review
   */
  calculateNewRating(newRating: number): { averageRating: number; totalReviews: number } {
    const newTotal = this.totalReviews + 1;
    const newAverage =
      (this.averageRating * this.totalReviews + newRating) / newTotal;
    return {
      averageRating: Math.round(newAverage * 100) / 100, // Round to 2 decimals
      totalReviews: newTotal,
    };
  }

  /**
   * Create a new entity with updated rating
   */
  withUpdatedRating(newRating: number, now?: Date): ServiceProviderEntity {
    const { averageRating, totalReviews } = this.calculateNewRating(newRating);
    return new ServiceProviderEntity(
      this.id,
      this.type,
      averageRating,
      totalReviews,
      this.createdAt,
      now ?? new Date(),
    );
  }

  /**
   * Recalculate rating after a review is removed
   */
  withRemovedRating(removedRating: number, now?: Date): ServiceProviderEntity {
    if (this.totalReviews <= 1) {
      return new ServiceProviderEntity(
        this.id,
        this.type,
        0,
        0,
        this.createdAt,
        now ?? new Date(),
      );
    }

    const newTotal = this.totalReviews - 1;
    const newAverage =
      (this.averageRating * this.totalReviews - removedRating) / newTotal;

    return new ServiceProviderEntity(
      this.id,
      this.type,
      Math.round(newAverage * 100) / 100,
      newTotal,
      this.createdAt,
      now ?? new Date(),
    );
  }
}

