import { Company, CompanyTrade, Trade, ServiceProvider, User, CompanyStatus as PrismaCompanyStatus } from '@prisma/client';
import { CompanyEntity, TradeInfo, CompanyStatus } from '../../domain/entities/company.entity';
import { ServiceProviderEntity, ProviderType } from '../../domain/entities/service-provider.entity';

type CompanyWithRelations = Company & {
  serviceProvider: ServiceProvider;
  trades?: (CompanyTrade & { trade: Trade })[];
  user?: Partial<User>;
};

export class CompanyPrismaMapper {
  static toDomain(company: CompanyWithRelations): CompanyEntity {
    const trades: TradeInfo[] = (company.trades ?? []).map((ct) => ({
      id: ct.trade.id,
      name: ct.trade.name,
      category: ct.trade.category,
      description: ct.trade.description,
      isPrimary: ct.isPrimary,
    }));

    const serviceProvider = new ServiceProviderEntity(
      company.serviceProvider.id,
      company.serviceProvider.type as ProviderType,
      company.serviceProvider.averageRating,
      company.serviceProvider.totalReviews,
      company.serviceProvider.createdAt,
      company.serviceProvider.updatedAt,
    );

    return new CompanyEntity(
      company.id,
      company.userId,
      company.serviceProviderId,
      company.companyName,
      company.legalName,
      company.taxId,
      trades,
      company.description,
      company.foundedYear,
      company.employeeCount,
      company.website,
      company.address,
      company.city,
      company.zone,
      company.status as CompanyStatus,
      company.profileImage,
      company.gallery as string[],
      company.createdAt,
      company.updatedAt,
      serviceProvider,
      company.user,
    );
  }

  static toPersistenceCreate(entity: CompanyEntity): any {
    return {
      id: entity.id,
      userId: entity.userId,
      serviceProviderId: entity.serviceProviderId,
      companyName: entity.companyName,
      legalName: entity.legalName,
      taxId: entity.taxId,
      description: entity.description,
      foundedYear: entity.foundedYear,
      employeeCount: entity.employeeCount,
      website: entity.website,
      address: entity.address,
      city: entity.city,
      zone: entity.zone,
      status: entity.status as PrismaCompanyStatus,
      profileImage: entity.profileImage,
      gallery: entity.gallery,
    };
  }

  static toPersistenceUpdate(entity: CompanyEntity): any {
    return {
      companyName: entity.companyName,
      legalName: entity.legalName,
      taxId: entity.taxId,
      description: entity.description,
      foundedYear: entity.foundedYear,
      employeeCount: entity.employeeCount,
      website: entity.website,
      address: entity.address,
      city: entity.city,
      zone: entity.zone,
      status: entity.status as PrismaCompanyStatus,
      profileImage: entity.profileImage,
      gallery: entity.gallery,
    };
  }
}
