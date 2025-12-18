import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { TradeRepository } from '../../domain/repositories/trade.repository';
import { TradeEntity } from '../../domain/entities/trade.entity';
import { ProfessionalStatus } from '@prisma/client';

@Injectable()
export class PrismaTradeRepository implements TradeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TradeEntity | null> {
    const trade = await this.prisma.trade.findUnique({
      where: { id },
    });

    if (!trade) return null;

    return this.toEntity(trade);
  }

  async findByName(name: string): Promise<TradeEntity | null> {
    const trade = await this.prisma.trade.findUnique({
      where: { name },
    });

    if (!trade) return null;

    return this.toEntity(trade);
  }

  async findAll(): Promise<TradeEntity[]> {
    const trades = await this.prisma.trade.findMany({
      orderBy: { name: 'asc' },
    });

    return trades.map((trade) => this.toEntity(trade));
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

    return trades.map((trade) => this.toEntity(trade));
  }

  async create(tradeData: Omit<TradeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TradeEntity> {
    const trade = await this.prisma.trade.create({
      data: {
        name: tradeData.name,
        category: tradeData.category,
        description: tradeData.description,
      },
    });

    return this.toEntity(trade);
  }

  async update(id: string, data: Partial<TradeEntity>): Promise<TradeEntity> {
    const trade = await this.prisma.trade.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    return this.toEntity(trade);
  }

  private toEntity(trade: any): TradeEntity {
    return new TradeEntity(
      trade.id,
      trade.name,
      trade.category,
      trade.description,
      trade.createdAt,
      trade.updatedAt,
    );
  }
}

