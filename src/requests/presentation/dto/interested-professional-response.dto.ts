import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';

/**
 * Response DTO for interested provider in a request.
 * Includes provider info for display in the client's request view.
 * Works with both Professional and Company providers.
 */
export class InterestedProfessionalResponseDto {
  @ApiProperty({ description: 'Interest ID' })
  id: string;

  @ApiProperty({ description: 'Request ID' })
  requestId: string;

  @ApiProperty({ description: 'ServiceProvider ID' })
  serviceProviderId: string;

  /**
   * @deprecated Use serviceProviderId instead
   */
  @ApiProperty({ description: 'Professional ID (deprecated, use serviceProviderId)' })
  professionalId: string;

  @ApiPropertyOptional({ description: 'Message from provider' })
  message: string | null;

  @ApiProperty({ description: 'When interest was expressed' })
  createdAt: Date;

  // Provider info (populated when available)
  @ApiPropertyOptional({
    description: 'Provider info',
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['PROFESSIONAL', 'COMPANY'] },
      displayName: { type: 'string' },
      profileImage: { type: 'string', nullable: true },
      averageRating: { type: 'number' },
      totalReviews: { type: 'number' },
    },
  })
  provider?: {
    id: string;
    type: 'PROFESSIONAL' | 'COMPANY';
    displayName: string;
    profileImage: string | null;
    averageRating: number;
    totalReviews: number;
  };

  /**
   * Convert domain entity to response DTO.
   */
  static fromEntity(entity: RequestInterestEntity): InterestedProfessionalResponseDto {
    const dto = new InterestedProfessionalResponseDto();

    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.serviceProviderId = entity.serviceProviderId;
    dto.professionalId = entity.serviceProviderId; // Backward compat
    dto.message = entity.message;
    dto.createdAt = entity.createdAt;

    if (entity.provider) {
      dto.provider = {
        id: entity.provider.id,
        type: entity.provider.type,
        displayName: entity.provider.displayName,
        profileImage: entity.provider.profileImage,
        averageRating: entity.provider.averageRating,
        totalReviews: entity.provider.totalReviews,
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
