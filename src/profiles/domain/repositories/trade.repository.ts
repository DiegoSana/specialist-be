import { TradeEntity } from '../entities/trade.entity';

export interface TradeRepository {
  findById(id: string): Promise<TradeEntity | null>;
  findByName(name: string): Promise<TradeEntity | null>;
  findAll(): Promise<TradeEntity[]>;
  findWithActiveProfessionals(): Promise<TradeEntity[]>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(trade: TradeEntity): Promise<TradeEntity>;
}

// Token for dependency injection
export const TRADE_REPOSITORY = Symbol('TradeRepository');
