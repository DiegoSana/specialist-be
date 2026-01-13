import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { ReviewStatus } from '../../domain/value-objects/review-status';

/**
 * Nested DTO for reviewer info in review response
 */
export class ReviewerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

/**
 * Nested DTO for professional user info
 */
export class ReviewProfessionalUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

/**
 * Nested DTO for professional info in review response
 */
export class ReviewProfessionalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ type: ReviewProfessionalUserDto })
  user?: ReviewProfessionalUserDto;
}

/**
 * Response DTO for review endpoints.
 * Provides a clean API contract independent of domain entity structure.
 */
export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty()
  professionalId: string;

  @ApiPropertyOptional()
  requestId: string | null;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional()
  moderatedAt: Date | null;

  @ApiPropertyOptional()
  moderatedBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Related data (populated when available)
  @ApiPropertyOptional({ type: ReviewerDto })
  reviewer?: ReviewerDto;

  @ApiPropertyOptional({ type: ReviewProfessionalDto })
  professional?: ReviewProfessionalDto;

  /**
   * Convert domain entity to response DTO.
   * The entity may have attached reviewer/professional data from the Prisma mapper.
   */
  static fromEntity(entity: ReviewEntity): ReviewResponseDto {
    const dto = new ReviewResponseDto();

    // Core fields
    dto.id = entity.id;
    dto.reviewerId = entity.reviewerId;
    dto.professionalId = entity.professionalId;
    dto.requestId = entity.requestId;
    dto.rating = entity.rating;
    dto.comment = entity.comment;
    dto.status = entity.status;
    dto.moderatedAt = entity.moderatedAt;
    dto.moderatedBy = entity.moderatedBy;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    // Extract attached related data from entity (set by Prisma mapper)
    const entityAny = entity as any;

    if (entityAny.reviewer) {
      dto.reviewer = {
        id: entityAny.reviewer.id,
        firstName: entityAny.reviewer.firstName,
        lastName: entityAny.reviewer.lastName,
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
            }
          : undefined,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(entities: ReviewEntity[]): ReviewResponseDto[] {
    return entities.map((entity) => ReviewResponseDto.fromEntity(entity));
  }
}

/**
 * Simplified DTO for public review lists.
 * Excludes moderation info and other internal fields.
 */
export class PublicReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional()
  comment: string | null;

  @ApiProperty()
  createdAt: Date;

  // Reviewer name (for public display)
  @ApiPropertyOptional({ type: ReviewerDto })
  reviewer?: ReviewerDto;

  /**
   * Convert domain entity to public review DTO.
   * Only for APPROVED reviews.
   */
  static fromEntity(entity: ReviewEntity): PublicReviewDto {
    const dto = new PublicReviewDto();

    dto.id = entity.id;
    dto.rating = entity.rating;
    dto.comment = entity.comment;
    dto.createdAt = entity.createdAt;

    // Extract reviewer info
    const entityAny = entity as any;
    if (entityAny.reviewer) {
      dto.reviewer = {
        id: entityAny.reviewer.id,
        firstName: entityAny.reviewer.firstName,
        lastName: entityAny.reviewer.lastName,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(entities: ReviewEntity[]): PublicReviewDto[] {
    return entities.map((entity) => PublicReviewDto.fromEntity(entity));
  }
}

