import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';

/**
 * Nested DTO for user info
 */
export class InterestedProfessionalUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  profilePictureUrl: string | null;
}

/**
 * Response DTO for interested professional in a request.
 * Includes professional info for display in the client's request view.
 */
export class InterestedProfessionalResponseDto {
  @ApiProperty({ description: 'Interest ID' })
  id: string;

  @ApiProperty({ description: 'Request ID' })
  requestId: string;

  @ApiProperty({ description: 'Professional ID' })
  professionalId: string;

  @ApiPropertyOptional({ description: 'Message from professional' })
  message: string | null;

  @ApiProperty({ description: 'When interest was expressed' })
  createdAt: Date;

  // Professional info (populated when available)
  @ApiPropertyOptional({ type: InterestedProfessionalUserDto })
  professional?: {
    id: string;
    userId: string;
    user: InterestedProfessionalUserDto | null;
    averageRating: number;
    totalReviews: number;
    description: string | null;
    experienceYears: number | null;
  };

  /**
   * Convert domain entity to response DTO.
   * The entity may have attached professional data from the Prisma mapper.
   */
  static fromEntity(entity: RequestInterestEntity): InterestedProfessionalResponseDto {
    const dto = new InterestedProfessionalResponseDto();

    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.professionalId = entity.professionalId;
    dto.message = entity.message;
    dto.createdAt = entity.createdAt;

    // Extract attached professional data from entity (set by Prisma mapper)
    const entityAny = entity as any;
    if (entityAny.professional) {
      const professional = entityAny.professional;
      dto.professional = {
        id: professional.id,
        userId: professional.userId,
        user: professional.user
          ? {
              id: professional.user.id,
              firstName: professional.user.firstName,
              lastName: professional.user.lastName,
              profilePictureUrl: professional.user.profilePictureUrl ?? null,
            }
          : null,
        averageRating: professional.averageRating ?? 0,
        totalReviews: professional.totalReviews ?? 0,
        description: professional.description ?? null,
        experienceYears: professional.experienceYears ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(
    entities: RequestInterestEntity[],
  ): InterestedProfessionalResponseDto[] {
    return entities.map((entity) =>
      InterestedProfessionalResponseDto.fromEntity(entity),
    );
  }
}

