import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestInterestRepository } from '../../domain/repositories/request-interest.repository';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { PrismaRequestInterestMapper } from '../mappers/request-interest.prisma-mapper';

@Injectable()
export class PrismaRequestInterestRepository
  implements RequestInterestRepository
{
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

    return interests.map((i) => PrismaRequestInterestMapper.toDomain(i));
  }

  async findByProfessionalId(
    professionalId: string,
  ): Promise<RequestInterestEntity[]> {
    const interests = await this.prisma.requestInterest.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
    });

    return interests.map((i) => PrismaRequestInterestMapper.toDomain(i));
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

    return interest ? PrismaRequestInterestMapper.toDomain(interest) : null;
  }

  async add(data: {
    requestId: string;
    professionalId: string;
    message: string | null;
  }): Promise<RequestInterestEntity> {
    const interest = await this.prisma.requestInterest.create({
      data: {
        ...PrismaRequestInterestMapper.toPersistenceCreate(data),
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

    return PrismaRequestInterestMapper.toDomain(interest);
  }

  async remove(requestId: string, professionalId: string): Promise<void> {
    await this.prisma.requestInterest.delete({
      where: {
        requestId_professionalId: {
          requestId,
          professionalId,
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
