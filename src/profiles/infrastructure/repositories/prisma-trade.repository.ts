import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { TradeRepository } from '../../domain/repositories/trade.repository';
import { TradeEntity } from '../../domain/entities/trade.entity';
import { ProfessionalStatus } from '@prisma/client';
import { PrismaTradeMapper } from '../mappers/trade.prisma-mapper';

@Injectable()
export class PrismaTradeRepository implements TradeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TradeEntity | null> {
    const trade = await this.prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) return null;

    return PrismaTradeMapper.toDomain(trade);
  }

  async findByName(name: string): Promise<TradeEntity | null> {
    const trade = await this.prisma.trade.findUnique({
      where: { name },
    });

    if (!trade) return null;

    return PrismaTradeMapper.toDomain(trade);
  }

  async findAll(): Promise<TradeEntity[]> {
    const trades = await this.prisma.trade.findMany({
      orderBy: { name: 'asc' },
    });

    return trades.map((trade) => PrismaTradeMapper.toDomain(trade));
  }

  async findWithActiveProfessionals(): Promise<TradeEntity[]> {
    // Find trades that have at least one active and verified professional
    const trades = await this.prisma.trade.findMany({
      where: {
        professionals: {
          some: {
            professional: {
              active: true,
              status: ProfessionalStatus.VERIFIED,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return trades.map((trade) => PrismaTradeMapper.toDomain(trade));
  }

  async create(
    tradeData: Omit<TradeEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TradeEntity> {
    const trade = await this.prisma.trade.create({
      data: {
        ...PrismaTradeMapper.toPersistenceCreate(tradeData),
      },
    });

    return PrismaTradeMapper.toDomain(trade);
  }

  async update(id: string, data: Partial<TradeEntity>): Promise<TradeEntity> {
    const trade = await this.prisma.trade.update({
      where: { id },
      data: {
        ...PrismaTradeMapper.toPersistenceUpdate(data),
      },
    });

    return PrismaTradeMapper.toDomain(trade);
  }
}
