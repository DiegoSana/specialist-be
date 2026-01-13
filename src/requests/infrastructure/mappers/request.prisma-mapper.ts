import { RequestStatus } from '@prisma/client';
import { RequestEntity } from '../../domain/entities/request.entity';

export class PrismaRequestMapper {
  static toDomain(request: any): RequestEntity {
    const entity = new RequestEntity(
      request.id,
      request.clientId,
      request.providerId, // Now using providerId (ServiceProvider ID)
      request.tradeId,
      request.isPublic,
      request.title || '',
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

    // Map provider data (which includes professional or company through serviceProvider)
    if (request.provider) {
      const provider = request.provider;
      
      // Attach the provider with its professional or company data
      (entity as any).provider = {
        id: provider.id,
        type: provider.type,
        averageRating: provider.averageRating,
        totalReviews: provider.totalReviews,
      };

      // If provider has a professional, map it
      if (provider.professional) {
        const professional = provider.professional;
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
          serviceProviderId: professional.serviceProviderId,
          trades,
          description: professional.description,
          experienceYears: professional.experienceYears,
          status: professional.status,
          zone: professional.zone,
          city: professional.city,
          address: professional.address,
          whatsapp: professional.whatsapp,
          website: professional.website,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          profileImage: professional.profileImage,
          gallery: professional.gallery || [],
          active: professional.active,
          user: professional.user,
        };
      }

      // If provider has a company, map it
      if (provider.company) {
        const company = provider.company;
        const trades = (company.trades || []).map((ct: any) => ({
          id: ct.trade.id,
          name: ct.trade.name,
          category: ct.trade.category,
          description: ct.trade.description,
          isPrimary: ct.isPrimary,
        }));

        (entity as any).company = {
          id: company.id,
          userId: company.userId,
          serviceProviderId: company.serviceProviderId,
          companyName: company.companyName,
          legalName: company.legalName,
          taxId: company.taxId,
          description: company.description,
          foundedYear: company.foundedYear,
          employeeCount: company.employeeCount,
          website: company.website,
          phone: company.phone,
          email: company.email,
          address: company.address,
          city: company.city,
          zone: company.zone,
          status: company.status,
          averageRating: provider.averageRating,
          totalReviews: provider.totalReviews,
          profileImage: company.profileImage,
          gallery: company.gallery || [],
          active: company.active,
          trades,
          user: company.user,
        };
      }
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
    providerId: string | null; // ServiceProvider ID
    tradeId: string | null;
    isPublic: boolean;
    title: string;
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
      providerId: input.providerId,
      tradeId: input.tradeId,
      isPublic: input.isPublic,
      title: input.title,
      description: input.description,
      address: input.address,
      availability: input.availability,
      photos: input.photos,
      status: input.status,
      quoteAmount: input.quoteAmount,
      quoteNotes: input.quoteNotes,
    };
  }

  static toPersistenceUpdate(
    partial: Partial<RequestEntity>,
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (partial.title !== undefined) updateData.title = partial.title;
    if (partial.description !== undefined)
      updateData.description = partial.description;
    if (partial.status !== undefined) updateData.status = partial.status;
    if (partial.quoteAmount !== undefined)
      updateData.quoteAmount = partial.quoteAmount;
    if (partial.quoteNotes !== undefined)
      updateData.quoteNotes = partial.quoteNotes;
    if (partial.photos !== undefined) updateData.photos = partial.photos;
    if (partial.providerId !== undefined)
      updateData.providerId = partial.providerId;
    if (partial.clientRating !== undefined)
      updateData.clientRating = partial.clientRating;
    if (partial.clientRatingComment !== undefined)
      updateData.clientRatingComment = partial.clientRatingComment;

    return updateData;
  }
}
