import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestInterestRepository } from '../../domain/repositories/request-interest.repository';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { ProviderType } from '@prisma/client';

@Injectable()
export class PrismaRequestInterestRepository
  implements RequestInterestRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private readonly providerInclude = {
    serviceProvider: {
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePictureUrl: true,
              },
            },
          },
        },
        company: true,
      },
    },
  } as const;

  private mapToDomain(raw: any): RequestInterestEntity {
    const sp = raw.serviceProvider;
    let providerInfo: RequestInterestEntity['provider'] | undefined;

    if (sp) {
      if (sp.type === ProviderType.PROFESSIONAL && sp.professional) {
        const prof = sp.professional;
        const user = prof.user;
        providerInfo = {
          id: sp.id,
          type: 'PROFESSIONAL',
          displayName: user ? `${user.firstName} ${user.lastName}` : 'Especialista',
          profileImage: prof.profileImage || user?.profilePictureUrl || null,
          averageRating: sp.averageRating,
          totalReviews: sp.totalReviews,
          whatsapp: prof.whatsapp || null,
          phone: prof.phone || null,
        };
      } else if (sp.type === ProviderType.COMPANY && sp.company) {
        providerInfo = {
          id: sp.id,
          type: 'COMPANY',
          displayName: sp.company.companyName,
          profileImage: sp.company.profileImage || null,
          averageRating: sp.averageRating,
          totalReviews: sp.totalReviews,
          whatsapp: null,
          phone: sp.company.phone || null,
        };
      }
    }

    return new RequestInterestEntity(
      raw.id,
      raw.requestId,
      raw.serviceProviderId,
      raw.message,
      raw.createdAt,
      providerInfo,
    );
  }

  async findByRequestId(requestId: string): Promise<RequestInterestEntity[]> {
    const interests = await this.prisma.requestInterest.findMany({
      where: { requestId },
      include: this.providerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((i) => this.mapToDomain(i));
  }

  async findByServiceProviderId(
    serviceProviderId: string,
  ): Promise<RequestInterestEntity[]> {
    const interests = await this.prisma.requestInterest.findMany({
      where: { serviceProviderId },
      include: this.providerInclude,
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((i) => this.mapToDomain(i));
  }

  async findByRequestAndProvider(
    requestId: string,
    serviceProviderId: string,
  ): Promise<RequestInterestEntity | null> {
    const interest = await this.prisma.requestInterest.findUnique({
      where: {
        requestId_serviceProviderId: {
          requestId,
          serviceProviderId,
        },
      },
      include: this.providerInclude,
    });

    return interest ? this.mapToDomain(interest) : null;
  }

  async add(data: {
    requestId: string;
    serviceProviderId: string;
    message: string | null;
  }): Promise<RequestInterestEntity> {
    const interest = await this.prisma.requestInterest.create({
      data: {
        requestId: data.requestId,
        serviceProviderId: data.serviceProviderId,
        message: data.message,
      },
      include: this.providerInclude,
    });

    return this.mapToDomain(interest);
  }

  async remove(requestId: string, serviceProviderId: string): Promise<void> {
    await this.prisma.requestInterest.delete({
      where: {
        requestId_serviceProviderId: {
          requestId,
          serviceProviderId,
        },
      },
    });
  }

  async removeAllByRequestId(requestId: string): Promise<void> {
    await this.prisma.requestInterest.deleteMany({
      where: { requestId },
    });
  }
}
