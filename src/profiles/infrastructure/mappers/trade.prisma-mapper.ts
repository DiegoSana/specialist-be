import { TradeEntity } from '../../domain/entities/trade.entity';

export class PrismaTradeMapper {
  static toDomain(trade: any): TradeEntity {
    return new TradeEntity(
      trade.id,
      trade.name,
      trade.category,
      trade.description,
      trade.createdAt,
      trade.updatedAt,
    );
  }

  static toPersistenceCreate(input: Omit<TradeEntity, 'id' | 'createdAt' | 'updatedAt'>): Record<string, unknown> {
    return {
      name: input.name,
      category: input.category,
      description: input.description,
    };
  }

  static toPersistenceUpdate(partial: Partial<TradeEntity>): Record<string, unknown> {
    return {
      ...(partial.name !== undefined && { name: partial.name }),
      ...(partial.category !== undefined && { category: partial.category }),
      ...(partial.description !== undefined && { description: partial.description }),
    };
  }
}

