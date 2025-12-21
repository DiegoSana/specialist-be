export class TradeEntity {
  static create(params: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    now?: Date;
  }): TradeEntity {
    const now = params.now ?? new Date();
    return new TradeEntity(
      params.id,
      params.name,
      params.category,
      params.description,
      now,
      now,
    );
  }

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: string | null,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  withChanges(changes: {
    name?: string;
    category?: string | null;
    description?: string | null;
    now?: Date;
  }): TradeEntity {
    const now = changes.now ?? new Date();
    return new TradeEntity(
      this.id,
      changes.name !== undefined ? changes.name : this.name,
      changes.category !== undefined ? changes.category : this.category,
      changes.description !== undefined
        ? changes.description
        : this.description,
      this.createdAt,
      now,
    );
  }
}
