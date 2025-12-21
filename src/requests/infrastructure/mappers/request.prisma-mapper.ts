import { RequestStatus } from '@prisma/client';
import { RequestEntity } from '../../domain/entities/request.entity';

export class PrismaRequestMapper {
  static toDomain(request: any): RequestEntity {
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

    // Mantener el comportamiento actual: adjuntar objetos para respuestas API.
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

    if (request.client) {
      (entity as any).client = {
        id: request.client.id,
        firstName: request.client.firstName,
        lastName: request.client.lastName,
        email: request.client.email,
        profilePictureUrl: request.client.profilePictureUrl,
      };
    }

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

  static toPersistenceCreate(input: {
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
  }): Record<string, unknown> {
    return {
      clientId: input.clientId,
      professionalId: input.professionalId,
      tradeId: input.tradeId,
      isPublic: input.isPublic,
      description: input.description,
      address: input.address,
      availability: input.availability,
      photos: input.photos,
      status: input.status,
      quoteAmount: input.quoteAmount,
      quoteNotes: input.quoteNotes,
    };
  }

  static toPersistenceUpdate(partial: Partial<RequestEntity>): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (partial.description !== undefined) updateData.description = partial.description;
    if (partial.status !== undefined) updateData.status = partial.status;
    if (partial.quoteAmount !== undefined) updateData.quoteAmount = partial.quoteAmount;
    if (partial.quoteNotes !== undefined) updateData.quoteNotes = partial.quoteNotes;
    if (partial.photos !== undefined) updateData.photos = partial.photos;
    if (partial.professionalId !== undefined) updateData.professionalId = partial.professionalId;
    if (partial.clientRating !== undefined) updateData.clientRating = partial.clientRating;
    if (partial.clientRatingComment !== undefined) updateData.clientRatingComment = partial.clientRatingComment;

    return updateData;
  }
}

