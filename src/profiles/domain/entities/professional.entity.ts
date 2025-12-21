import { ProfessionalStatus } from '@prisma/client';

export interface TradeInfo {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isPrimary: boolean;
}

export class ProfessionalEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly trades: TradeInfo[],
    public readonly description: string | null,
    public readonly experienceYears: number | null,
    public readonly status: ProfessionalStatus,
    public readonly zone: string | null,
    public readonly city: string,
    public readonly address: string | null,
    public readonly whatsapp: string | null,
    public readonly website: string | null,
    public readonly averageRating: number,
    public readonly totalReviews: number,
    public readonly profileImage: string | null,
    public readonly gallery: string[],
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get primaryTrade(): TradeInfo | null {
    return this.trades.find((t) => t.isPrimary) || this.trades[0] || null;
  }

  get tradeIds(): string[] {
    return this.trades.map((t) => t.id);
  }

  isVerified(): boolean {
    return this.status === ProfessionalStatus.VERIFIED;
  }

  isPending(): boolean {
    return this.status === ProfessionalStatus.PENDING_VERIFICATION;
  }

  isActive(): boolean {
    return this.active && this.isVerified();
  }
}
