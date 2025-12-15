import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestInterestRepository } from '../../domain/repositories/request-interest.repository';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';

@Injectable()
export class PrismaRequestInterestRepository implements RequestInterestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRequestId(requestId: string): Promise<RequestInterestEntity[]> {
    const interests = await this.prisma.requestInterest.findMany({
      where: { requestId },
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                profilePictureUrl: true,
              },
            },
            trades: {
              include: {
                trade: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((i) => this.toEntity(i));
  }

  async findByProfessionalId(professionalId: string): Promise<RequestInterestEntity[]> {
    const interests = await this.prisma.requestInterest.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((i) => this.toEntity(i));
  }

  async findByRequestAndProfessional(
    requestId: string,
    professionalId: string,
  ): Promise<RequestInterestEntity | null> {
    const interest = await this.prisma.requestInterest.findUnique({
      where: {
        requestId_professionalId: {
          requestId,
          professionalId,
        },
      },
    });

    return interest ? this.toEntity(interest) : null;
  }

  async create(data: {
    requestId: string;
    professionalId: string;
    message: string | null;
  }): Promise<RequestInterestEntity> {
    const interest = await this.prisma.requestInterest.create({
      data: {
        requestId: data.requestId,
        professionalId: data.professionalId,
        message: data.message,
      },
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                profilePictureUrl: true,
              },
            },
            trades: {
              include: {
                trade: true,
              },
            },
          },
        },
      },
    });

    return this.toEntity(interest);
  }

  async delete(requestId: string, professionalId: string): Promise<void> {
    await this.prisma.requestInterest.delete({
      where: {
        requestId_professionalId: {
          requestId,
          professionalId,
        },
      },
    });
  }

  async deleteAllByRequestId(requestId: string): Promise<void> {
    await this.prisma.requestInterest.deleteMany({
      where: { requestId },
    });
  }

  private toEntity(interest: any): RequestInterestEntity {
    const entity = new RequestInterestEntity(
      interest.id,
      interest.requestId,
      interest.professionalId,
      interest.message,
      interest.createdAt,
    );

    // Attach professional data if available
    if (interest.professional) {
      const professional = interest.professional;
      const trades = (professional.trades || []).map((pt: any) => ({
        id: pt.trade.id,
        name: pt.trade.name,
        category: pt.trade.category,
        description: pt.trade.description,
        isPrimary: pt.isPrimary,
      }));

      (entity as any).professional = {
        id: professional.id,
        userId: professional.userId,
        trades,
        description: professional.description,
        experienceYears: professional.experienceYears,
        status: professional.status,
        zone: professional.zone,
        city: professional.city,
        whatsapp: professional.whatsapp,
        averageRating: professional.averageRating,
        totalReviews: professional.totalReviews,
        user: professional.user,
      };
    }

    return entity;
  }
}



