import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import {
  RequestAuthContext,
  RequestEntity,
} from '../../domain/entities/request.entity';
// Cross-context: importing a domain entity TYPE from another context is allowed (see
// src/requests/CLAUDE.md / architecture rules — "Import from another context ONLY:
// application/services/*, domain/entities/* types, domain/events/*, shared/**").
import { ReviewEntity } from '../../../reputation/domain/entities/review.entity';
import { ReviewStatus } from '../../../reputation/domain/value-objects/review-status';

/**
 * Nested DTO for a review's own content — either myReview, or counterpartReview once revealed.
 */
export class RequestReviewSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional({
    description: 'null until both parties rated or the reveal timeout elapsed',
  })
  revealedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: ReviewEntity): RequestReviewSummaryDto {
    const dto = new RequestReviewSummaryDto();
    dto.id = entity.id;
    dto.rating = entity.rating;
    dto.comment = entity.comment;
    dto.status = entity.status;
    dto.revealedAt = entity.revealedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

/** counterpartReview before it's revealed: content hidden, only existence + own-submission state shown. */
export class PendingCounterpartReviewDto {
  @ApiProperty({ example: true })
  pending: true;
}

/**
 * Nested DTO for trade information in request response
 */
export class RequestTradeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  category: string | null;
}

/**
 * Nested DTO for user/professional info in request response
 */
export class RequestUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;

  @ApiPropertyOptional({
    description:
      'Contact phone. Only present once contact was released and the viewer is the client or the assigned provider (or admin).',
  })
  phone?: string | null;
}

/**
 * The request's client, as seen by the provider "in context" (no dedicated client profile page —
 * REVIEWS_REDESIGN.md section 2): adds the client's aggregate rating and curated highlights on
 * top of RequestUserDto.
 */
export class RequestClientDto extends RequestUserDto {
  @ApiPropertyOptional({
    description: 'Client aggregate rating from PROVIDER_TO_CLIENT reviews',
  })
  averageRating?: number;

  @ApiPropertyOptional()
  totalReviews?: number;

  @ApiPropertyOptional({
    type: [RequestReviewSummaryDto],
    description: 'Admin-curated (isFeatured) approved reviews of this client',
  })
  featuredReviews?: RequestReviewSummaryDto[];
}

/**
 * Nested DTO for professional info in request response
 */
export class RequestProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  user: RequestUserDto | null;

  @ApiPropertyOptional()
  averageRating: number;

  @ApiPropertyOptional()
  totalReviews: number;

  @ApiPropertyOptional()
  whatsapp: string | null;
}

/**
 * Nested DTO for company info in request response
 */
export class RequestCompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  serviceProviderId: string;

  @ApiProperty()
  companyName: string;

  @ApiPropertyOptional()
  legalName: string | null;

  @ApiPropertyOptional()
  taxId: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  email: string | null;

  @ApiPropertyOptional()
  website: string | null;

  @ApiPropertyOptional()
  city: string | null;

  @ApiPropertyOptional()
  zone: string | null;

  @ApiPropertyOptional()
  averageRating: number;

  @ApiPropertyOptional()
  totalReviews: number;

  @ApiPropertyOptional()
  profileImage: string | null;

  @ApiPropertyOptional({ type: RequestUserDto })
  user: RequestUserDto | null;

  @ApiProperty({ type: [Object] })
  trades: Array<{
    id: string;
    name: string;
    category: string | null;
    isPrimary: boolean;
  }>;
}

/**
 * Response DTO for request endpoints.
 * Provides a clean API contract independent of domain entity structure.
 */
export class RequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiPropertyOptional()
  professionalId: string | null; // Deprecated, use providerId

  @ApiPropertyOptional()
  providerId: string | null; // ServiceProvider ID (Professional or Company)

  @ApiPropertyOptional()
  tradeId: string | null;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  address: string | null;

  @ApiPropertyOptional()
  availability: string | null;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiPropertyOptional({
    description:
      'Deprecated: legacy flat field, read-only compat for requests closed before the bidirectional reviews redesign. New code should read counterpartReview/myReview instead.',
  })
  clientRating: number | null;

  @ApiPropertyOptional({
    description: 'Deprecated, see clientRating.',
  })
  clientRatingComment: string | null;

  @ApiPropertyOptional({
    type: RequestReviewSummaryDto,
    description:
      "The viewer's own review for this request (client's review of the provider, or provider's review of the client, depending on who is asking). Always visible to its author regardless of reveal state. Only populated on single-request detail responses.",
  })
  myReview?: RequestReviewSummaryDto | null;

  @ApiPropertyOptional({
    description:
      "The counterpart's review. Hidden behind `{ pending: true }` until both parties rated or the reveal timeout elapsed (doble-ciego con timeout). Only populated on single-request detail responses.",
  })
  counterpartReview?:
    | RequestReviewSummaryDto
    | PendingCounterpartReviewDto
    | null;

  @ApiPropertyOptional({
    description:
      'Reason recorded for NOT_COMPLETED / INTERRUPTED (or a resolution note)',
  })
  statusReason: string | null;

  @ApiPropertyOptional({
    description:
      'Number of specialists currently INTERESTED (excludes withdrawn / chosen / not chosen). Only present on the client list.',
  })
  interestsCount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Related data (populated when available)
  @ApiPropertyOptional({ type: RequestClientDto })
  client?: RequestClientDto;

  @ApiPropertyOptional({ type: RequestProfessionalDto })
  professional?: RequestProfessionalDto;

  @ApiPropertyOptional({ type: RequestCompanyDto })
  company?: RequestCompanyDto;

  @ApiPropertyOptional({ type: RequestTradeDto })
  trade?: RequestTradeDto;

  /**
   * Convert domain entity to response DTO.
   * The entity may have attached related data (client, professional, trade)
   * from the repository's Prisma mapper.
   *
   * @param entity - Request domain entity (may include attached related data)
   */
  static fromEntity(
    entity: RequestEntity,
    viewer?: RequestAuthContext,
    extra?: {
      /** Viewer's own review for this request. Omit to leave myReview undefined. */
      myReview?: ReviewEntity | null;
      /** The other party's review for this request. Omit to leave counterpartReview undefined. */
      counterpartReview?: ReviewEntity | null;
      /** Admin-curated featured reviews of the client, for the provider-facing "in context" view. */
      clientFeaturedReviews?: ReviewEntity[];
    },
  ): RequestResponseDto {
    const dto = new RequestResponseDto();
    // Safe default: without a viewer context no contact data is exposed.
    const showContact = viewer
      ? entity.canViewCounterpartContactBy(viewer)
      : false;

    // Core fields
    dto.id = entity.id;
    dto.clientId = entity.clientId;
    dto.professionalId = entity.professionalId; // Backward compat
    dto.providerId = entity.providerId;
    dto.tradeId = entity.tradeId;
    dto.isPublic = entity.isPublic;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.address = entity.address;
    dto.availability = entity.availability;
    dto.photos = entity.photos;
    dto.status = entity.status;
    dto.clientRating = entity.clientRating;
    dto.clientRatingComment = entity.clientRatingComment;

    if (extra) {
      dto.myReview = extra.myReview
        ? RequestReviewSummaryDto.fromEntity(extra.myReview)
        : (extra.myReview ?? null);

      if (extra.counterpartReview === undefined) {
        dto.counterpartReview = undefined;
      } else if (extra.counterpartReview === null) {
        dto.counterpartReview = null;
      } else if (
        extra.counterpartReview.isVisibleTo(
          viewer?.userId ?? '',
          !!viewer?.isAdmin,
        )
      ) {
        dto.counterpartReview = RequestReviewSummaryDto.fromEntity(
          extra.counterpartReview,
        );
      } else {
        dto.counterpartReview = { pending: true };
      }
    }
    dto.statusReason = entity.statusReason;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    // Extract attached related data from entity (set by Prisma mapper)
    const entityAny = entity as any;

    if (typeof entityAny.interestsCount === 'number') {
      dto.interestsCount = entityAny.interestsCount;
    }

    if (entityAny.client) {
      dto.client = {
        id: entityAny.client.id,
        firstName: entityAny.client.firstName,
        lastName: entityAny.client.lastName,
        profilePictureUrl: entityAny.client.profilePictureUrl ?? null,
        ...(showContact ? { phone: entityAny.client.phone ?? null } : {}),
        averageRating: entityAny.client.clientAverageRating ?? 0,
        totalReviews: entityAny.client.clientTotalReviews ?? 0,
        ...(extra?.clientFeaturedReviews
          ? {
              featuredReviews: extra.clientFeaturedReviews.map((r) =>
                RequestReviewSummaryDto.fromEntity(r),
              ),
            }
          : {}),
      };
    }

    if (entityAny.professional) {
      dto.professional = {
        id: entityAny.professional.id,
        userId: entityAny.professional.userId,
        user: entityAny.professional.user
          ? {
              id: entityAny.professional.user.id,
              firstName: entityAny.professional.user.firstName,
              lastName: entityAny.professional.user.lastName,
              profilePictureUrl:
                entityAny.professional.user.profilePictureUrl ?? null,
              ...(showContact
                ? { phone: entityAny.professional.user.phone ?? null }
                : {}),
            }
          : null,
        averageRating: entityAny.professional.averageRating ?? 0,
        totalReviews: entityAny.professional.totalReviews ?? 0,
        whatsapp: showContact
          ? (entityAny.professional?.user?.phone ?? null)
          : null,
      };
    }

    if (entityAny.company) {
      dto.company = {
        id: entityAny.company.id,
        userId: entityAny.company.userId,
        serviceProviderId: entityAny.company.serviceProviderId,
        companyName: entityAny.company.companyName,
        legalName: entityAny.company.legalName ?? null,
        taxId: entityAny.company.taxId ?? null,
        description: entityAny.company.description ?? null,
        phone: showContact ? (entityAny.company?.user?.phone ?? null) : null,
        email: showContact ? (entityAny.company?.user?.email ?? null) : null,
        website: entityAny.company.website ?? null,
        city: entityAny.company.city ?? null,
        zone: entityAny.company.zone ?? null,
        averageRating: entityAny.company.averageRating ?? 0,
        totalReviews: entityAny.company.totalReviews ?? 0,
        profileImage: entityAny.company.profileImage ?? null,
        user: entityAny.company.user
          ? {
              id: entityAny.company.user.id,
              firstName: entityAny.company.user.firstName,
              lastName: entityAny.company.user.lastName,
              profilePictureUrl:
                entityAny.company.user.profilePictureUrl ?? null,
              ...(showContact
                ? { phone: entityAny.company.user.phone ?? null }
                : {}),
            }
          : null,
        trades: (entityAny.company.trades || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          isPrimary: t.isPrimary,
        })),
      };
    }

    if (entityAny.trade) {
      dto.trade = {
        id: entityAny.trade.id,
        name: entityAny.trade.name,
        category: entityAny.trade.category ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(
    entities: RequestEntity[],
    viewer?: RequestAuthContext,
  ): RequestResponseDto[] {
    return entities.map((entity) =>
      RequestResponseDto.fromEntity(entity, viewer),
    );
  }

  /**
   * Limited view for providers who expressed interest but were not assigned.
   * Only id, title, description, status, createdAt; all other fields left null/empty.
   */
  static fromEntityLimited(entity: RequestEntity): RequestResponseDto {
    const dto = new RequestResponseDto();
    dto.id = entity.id;
    dto.clientId = entity.clientId;
    dto.professionalId = null;
    dto.providerId = entity.providerId;
    dto.tradeId = entity.tradeId;
    dto.isPublic = entity.isPublic;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.address = null;
    dto.availability = null;
    dto.photos = [];
    dto.status = entity.status;
    dto.clientRating = null;
    dto.clientRatingComment = null;
    dto.statusReason = null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.client = undefined;
    dto.professional = undefined;
    dto.company = undefined;
    dto.trade = undefined;
    return dto;
  }
}
