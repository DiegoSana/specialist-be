import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, ProviderType } from '@prisma/client';
import { RequestEntity } from '../../../requests/domain/entities/request.entity';
import { RequestInterestEntity } from '../../../requests/domain/entities/request-interest.entity';
import { InterestedProfessionalResponseDto } from '../../../requests/presentation/dto/interested-professional-response.dto';
import { ReviewEntity } from '../../../reputation/domain/entities/review.entity';
// NOTE: ReviewEntity.status is typed with this domain value object, not the @prisma/client
// ReviewStatus enum - the two are structurally identical (PENDING|APPROVED|REJECTED) but
// TypeScript treats string enums as nominal types, so assigning review.status into a field typed
// with the Prisma enum fails to compile. Using the domain type here (already an allowed
// cross-context import alongside RequestEntity/RequestInterestEntity above) avoids that mismatch.
import { ReviewStatus } from '../../../reputation/domain/value-objects/review-status';

class AdminRequestClientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;
}

class AdminRequestTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class AdminRequestProviderTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class AdminRequestReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  static fromEntity(review: ReviewEntity): AdminRequestReviewDto {
    const dto = new AdminRequestReviewDto();
    dto.id = review.id;
    dto.rating = review.rating;
    dto.comment = review.comment;
    dto.status = review.status;
    return dto;
  }
}

class AdminRequestProviderDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ProviderType })
  type: ProviderType;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    description: 'Owning user id, for linking to /admin/users/:id',
  })
  userId?: string;

  @ApiPropertyOptional({ type: [AdminRequestProviderTradeDto] })
  trades?: AdminRequestProviderTradeDto[];
}

/**
 * Full admin-facing view of a single request: base request fields, resolved
 * client/trade, a unified provider (Professional or Company) view and the
 * list of providers who expressed interest. Unlike the participant-facing
 * `GET /requests/:id`, this endpoint applies no `canBeViewedBy` ownership
 * check - any admin may view any request.
 */
export class AdminRequestDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  address: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiPropertyOptional({ type: AdminRequestTradeDto })
  trade: AdminRequestTradeDto | null;

  @ApiPropertyOptional({ type: AdminRequestClientDto })
  client: AdminRequestClientDto | null;

  @ApiPropertyOptional({ type: AdminRequestProviderDto })
  provider: AdminRequestProviderDto | null;

  @ApiProperty({ type: [InterestedProfessionalResponseDto] })
  interestedProviders: InterestedProfessionalResponseDto[];

  @ApiProperty({ type: AdminRequestReviewDto, nullable: true })
  review: AdminRequestReviewDto | null;

  @ApiPropertyOptional({
    description:
      "Provider's rating of the client (1-5), set via POST /requests/:id/rate-client after the request is CLOSED. Independent of the Reputation `review` above (client rating the provider) and has no moderation status.",
  })
  clientRating: number | null;

  @ApiPropertyOptional()
  clientRatingComment: string | null;

  static fromEntity(
    entity: RequestEntity,
    interestedProviders: RequestInterestEntity[],
    review: ReviewEntity | null = null,
  ): AdminRequestDetailResponseDto {
    const dto = new AdminRequestDetailResponseDto();
    const entityAny = entity as any;

    dto.id = entity.id;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.address = entity.address;
    dto.isPublic = entity.isPublic;
    dto.photos = entity.photos;

    dto.trade = entityAny.trade
      ? { id: entityAny.trade.id, name: entityAny.trade.name }
      : null;

    dto.client = entityAny.client
      ? {
          id: entityAny.client.id,
          firstName: entityAny.client.firstName,
          lastName: entityAny.client.lastName,
          email: entityAny.client.email,
          profilePictureUrl: entityAny.client.profilePictureUrl ?? null,
        }
      : null;

    dto.provider = AdminRequestDetailResponseDto.resolveProvider(entityAny);

    dto.interestedProviders =
      InterestedProfessionalResponseDto.fromEntities(interestedProviders);

    dto.review = review ? AdminRequestReviewDto.fromEntity(review) : null;

    dto.clientRating = entity.clientRating;
    dto.clientRatingComment = entity.clientRatingComment;

    return dto;
  }

  private static resolveProvider(
    entityAny: any,
  ): AdminRequestProviderDto | null {
    if (!entityAny.provider) return null;

    if (entityAny.professional) {
      const user = entityAny.professional.user;
      return {
        id: entityAny.provider.id,
        type: entityAny.provider.type,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
        userId: entityAny.professional.userId,
        trades: (entityAny.professional.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        })),
      };
    }

    if (entityAny.company) {
      return {
        id: entityAny.provider.id,
        type: entityAny.provider.type,
        name: entityAny.company.companyName,
        userId: entityAny.company.userId,
        trades: (entityAny.company.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        })),
      };
    }

    return null;
  }
}
