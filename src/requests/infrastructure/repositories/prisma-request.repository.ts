import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RequestRepository } from '../../domain/repositories/request.repository';
import { RequestEntity } from '../../domain/entities/request.entity';
import { RequestStatus, ProfessionalStatus } from '@prisma/client';

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

    return this.toEntity(request);
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

    return requests.map((r) => this.toEntity(r));
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

    return requests.map((r) => this.toEntity(r));
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

    return requests.map((r) => this.toEntity(r));
  }

  async findAvailableForProfessional(tradeIds: string[], city?: string, zone?: string): Promise<RequestEntity[]> {
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

    return requests.map((r) => this.toEntity(r));
  }

  async create(
    requestData: {
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
    },
  ): Promise<RequestEntity> {
    const request = await this.prisma.request.create({
      data: {
        clientId: requestData.clientId,
        professionalId: requestData.professionalId,
        tradeId: requestData.tradeId,
        isPublic: requestData.isPublic,
        description: requestData.description,
        address: requestData.address,
        availability: requestData.availability,
        photos: requestData.photos,
        status: requestData.status,
        quoteAmount: requestData.quoteAmount,
        quoteNotes: requestData.quoteNotes,
      },
      include: {
        trade: true,
      },
    });

    return this.toEntity(request);
  }

  async update(id: string, data: Partial<RequestEntity>): Promise<RequestEntity> {
    const updateData: any = {};
    
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.quoteAmount !== undefined) updateData.quoteAmount = data.quoteAmount;
    if (data.quoteNotes !== undefined) updateData.quoteNotes = data.quoteNotes;
    if (data.photos !== undefined) updateData.photos = data.photos;
    if (data.professionalId !== undefined) updateData.professionalId = data.professionalId;
    if (data.clientRating !== undefined) updateData.clientRating = data.clientRating;
    if (data.clientRatingComment !== undefined) updateData.clientRatingComment = data.clientRatingComment;

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

    return this.toEntity(request);
  }

  private toEntity(request: any): RequestEntity {
    const entity = new RequestEntity(
      request.id,
      request.clientId,
      request.professionalId,
      request.tradeId,
      request.isPublic,
      request.description,
      request.address,
      request.availability,
      request.photos || [],
      request.status as RequestStatus,
      request.quoteAmount,
      request.quoteNotes,
      request.clientRating,
      request.clientRatingComment,
      request.createdAt,
      request.updatedAt,
    );

    // Attach professional data if available (for API responses)
    if (request.professional) {
      const professional = request.professional;
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
        address: professional.address,
        whatsapp: professional.whatsapp,
        website: professional.website,
        averageRating: professional.averageRating,
        totalReviews: professional.totalReviews,
        profileImage: professional.profileImage,
        gallery: professional.gallery || [],
        active: professional.active,
        user: professional.user,
      };
    }

    // Attach client data if available (for API responses)
    if (request.client) {
      (entity as any).client = {
        id: request.client.id,
        firstName: request.client.firstName,
        lastName: request.client.lastName,
        email: request.client.email,
        profilePictureUrl: request.client.profilePictureUrl,
      };
    }

    // Attach trade data if available
    if (request.trade) {
      (entity as any).trade = {
        id: request.trade.id,
        name: request.trade.name,
        category: request.trade.category,
        description: request.trade.description,
      };
    }

    return entity;
  }
}
