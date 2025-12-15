export class TradeEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: string | null,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}

