import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestRepository } from '../../domain/repositories/request.repository';
import { RequestEntity } from '../../domain/entities/request.entity';
import { RequestStatus } from '@prisma/client';
import { PrismaRequestMapper } from '../mappers/request.prisma-mapper';

@Injectable()
export class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RequestEntity | null> {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        professional: {
          include: {
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
              },
            },
          },
        },
        trade: true,
      },
    });

    if (!request) return null;

    return PrismaRequestMapper.toDomain(request);
  }

  async findByClientId(clientId: string): Promise<RequestEntity[]> {
    const requests = await this.prisma.request.findMany({
      where: { clientId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        professional: {
          include: {
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
              },
            },
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => PrismaRequestMapper.toDomain(r));
  }

  async findByProfessionalId(professionalId: string): Promise<RequestEntity[]> {
    const requests = await this.prisma.request.findMany({
      where: { professionalId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        professional: {
          include: {
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
              },
            },
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => PrismaRequestMapper.toDomain(r));
  }

  async findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]> {
    const whereClause: any = {
      isPublic: true,
      status: RequestStatus.PENDING,
      professionalId: null, // Only show unassigned public requests
    };

    // Filter by trade if tradeIds are provided
    if (tradeIds && tradeIds.length > 0) {
      whereClause.tradeId = { in: tradeIds };
    }

    const requests = await this.prisma.request.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => PrismaRequestMapper.toDomain(r));
  }

  async findAvailableForProfessional(
    tradeIds: string[],
    _city?: string,
    _zone?: string,
  ): Promise<RequestEntity[]> {
    // Params reservados para futuros filtros (mantener contrato)
    void _city;
    void _zone;
    // Find public requests that match the professional's trades
    const requests = await this.prisma.request.findMany({
      where: {
        isPublic: true,
        status: RequestStatus.PENDING,
        professionalId: null,
        tradeId: {
          in: tradeIds,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        trade: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => PrismaRequestMapper.toDomain(r));
  }

  async create(requestData: {
    clientId: string;
    professionalId: string | null;
    tradeId: string | null;
    isPublic: boolean;
    description: string;
    address: string | null;
    availability: string | null;
    photos: string[];
    status: RequestStatus;
    quoteAmount: number | null;
    quoteNotes: string | null;
  }): Promise<RequestEntity> {
    const request = await this.prisma.request.create({
      data: {
        ...PrismaRequestMapper.toPersistenceCreate(requestData),
      },
      include: {
        trade: true,
      },
    });

    return PrismaRequestMapper.toDomain(request);
  }

  async update(
    id: string,
    data: Partial<RequestEntity>,
  ): Promise<RequestEntity> {
    const updateData = PrismaRequestMapper.toPersistenceUpdate(data);

    const request = await this.prisma.request.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePictureUrl: true,
          },
        },
        professional: {
          include: {
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
              },
            },
          },
        },
        trade: true,
      },
    });

    return PrismaRequestMapper.toDomain(request);
  }
}
