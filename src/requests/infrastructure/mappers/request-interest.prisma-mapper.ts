import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';

export class PrismaRequestInterestMapper {
  static toDomain(interest: any): RequestInterestEntity {
    const entity = new RequestInterestEntity(
      interest.id,
      interest.requestId,
      interest.professionalId,
      interest.message,
      interest.createdAt,
    );

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

  static toPersistenceCreate(input: {
    requestId: string;
    professionalId: string;
    message: string | null;
  }): Record<string, unknown> {
    return {
      requestId: input.requestId,
      professionalId: input.professionalId,
      message: input.message,
    };
  }
}
