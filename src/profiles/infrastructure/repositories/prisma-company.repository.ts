import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  CompanyRepository,
  CompanySearchParams,
} from '../../domain/repositories/company.repository';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CompanyPrismaMapper } from '../mappers/company.prisma-mapper';

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly fullInclude = {
    serviceProvider: true,
    trades: {
      include: {
        trade: true,
      },
    },
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePictureUrl: true,
      },
    },
  } as const;

  async findById(id: string): Promise<CompanyEntity | null> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: this.fullInclude,
    });

    if (!company) return null;
    return CompanyPrismaMapper.toDomain(company);
  }

  async findByUserId(userId: string): Promise<CompanyEntity | null> {
    const company = await this.prisma.company.findUnique({
      where: { userId },
      include: this.fullInclude,
    });

    if (!company) return null;
    return CompanyPrismaMapper.toDomain(company);
  }

  async findByServiceProviderId(serviceProviderId: string): Promise<CompanyEntity | null> {
    const company = await this.prisma.company.findUnique({
      where: { serviceProviderId },
      include: this.fullInclude,
    });

    if (!company) return null;
    return CompanyPrismaMapper.toDomain(company);
  }

  async search(params: CompanySearchParams): Promise<CompanyEntity[]> {
    const where: any = {};

    if (params.active !== undefined) {
      where.active = params.active;
    }

    if (params.verified !== undefined) {
      where.status = params.verified ? 'VERIFIED' : { not: 'VERIFIED' };
    }

    if (params.city) {
      where.city = params.city;
    }

    if (params.search) {
      where.OR = [
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.tradeId) {
      where.trades = {
        some: {
          tradeId: params.tradeId,
        },
      };
    }

    const companies = await this.prisma.company.findMany({
      where,
      include: this.fullInclude,
      orderBy: [
        { status: 'asc' }, // VERIFIED first
        { serviceProvider: { averageRating: 'desc' } },
        { createdAt: 'desc' },
      ],
    });

    return companies.map((c) => CompanyPrismaMapper.toDomain(c));
  }

  async save(company: CompanyEntity): Promise<CompanyEntity> {
    // Check if company exists
    const existing = await this.prisma.company.findUnique({
      where: { id: company.id },
    });

    if (existing) {
      // Update existing company
      const updated = await this.prisma.company.update({
        where: { id: company.id },
        data: CompanyPrismaMapper.toPersistenceUpdate(company),
        include: this.fullInclude,
      });
      return CompanyPrismaMapper.toDomain(updated);
    }

    // Create new company - first create ServiceProvider
    const serviceProvider = await this.prisma.serviceProvider.create({
      data: {
        id: company.serviceProviderId,
        type: 'COMPANY',
        averageRating: 0,
        totalReviews: 0,
      },
    });

    // Then create company
    const created = await this.prisma.company.create({
      data: {
        ...CompanyPrismaMapper.toPersistenceCreate(company),
        serviceProviderId: serviceProvider.id,
      },
      include: this.fullInclude,
    });

    return CompanyPrismaMapper.toDomain(created);
  }

  async delete(id: string): Promise<void> {
    // Get company to find serviceProviderId
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { serviceProviderId: true },
    });

    if (!company) return;

    // Delete company trades first
    await this.prisma.companyTrade.deleteMany({
      where: { companyId: id },
    });

    // Delete company
    await this.prisma.company.delete({
      where: { id },
    });

    // Delete orphan ServiceProvider if no longer used
    await this.prisma.serviceProvider.delete({
      where: { id: company.serviceProviderId },
    });
  }

  /**
   * Update company trades (replace all)
   */
  async updateTrades(companyId: string, tradeIds: string[], primaryTradeId?: string): Promise<void> {
    // Delete existing trades
    await this.prisma.companyTrade.deleteMany({
      where: { companyId },
    });

    // Create new trades
    await this.prisma.companyTrade.createMany({
      data: tradeIds.map((tradeId) => ({
        companyId,
        tradeId,
        isPrimary: tradeId === primaryTradeId,
      })),
    });
  }

  /**
   * Update ServiceProvider rating for a company
   */
  async updateRating(companyId: string, averageRating: number, totalReviews: number): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { serviceProviderId: true },
    });

    if (!company) return;

    await this.prisma.serviceProvider.update({
      where: { id: company.serviceProviderId },
      data: { averageRating, totalReviews },
    });
  }
}

