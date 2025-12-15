import { TradeEntity } from '../entities/trade.entity';

export interface TradeRepository {
  findById(id: string): Promise<TradeEntity | null>;
  findByName(name: string): Promise<TradeEntity | null>;
  findAll(): Promise<TradeEntity[]>;
  findWithActiveProfessionals(): Promise<TradeEntity[]>;
  create(trade: Omit<TradeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TradeEntity>;
  update(id: string, data: Partial<TradeEntity>): Promise<TradeEntity>;
}

// Token for dependency injection
export const TRADE_REPOSITORY = Symbol('TradeRepository');
