import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { RequestResponseDto } from './request-response.dto';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { RequestEntity } from '../../domain/entities/request.entity';

/**
 * DTO for requests where the current provider expressed interest.
 * Includes limited information if request was assigned to another provider.
 */
export class InterestedRequestDto {
  @ApiProperty({ description: 'Interest ID' })
  interestId: string;

  @ApiProperty({ description: 'When interest was expressed' })
  interestCreatedAt: Date;

  @ApiPropertyOptional({ description: 'Message sent with interest' })
  interestMessage: string | null;

  @ApiProperty({ description: 'Request ID' })
  requestId: string;

  @ApiProperty({ description: 'Request title' })
  title: string;

  @ApiProperty({ description: 'Request description' })
  description: string;

  @ApiProperty({ enum: RequestStatus, description: 'Current request status' })
  status: RequestStatus;

  @ApiProperty({ description: 'When request was created' })
  requestCreatedAt: Date;

  @ApiProperty({
    description: 'True if request was assigned to another provider',
  })
  assignedToOther: boolean;

  @ApiProperty({
    description: 'True if request was assigned to current provider',
  })
  assignedToMe: boolean;

  @ApiPropertyOptional({
    description:
      'Full request details (only if assignedToMe=true or assignedToOther=false)',
    type: RequestResponseDto,
  })
  fullRequest?: RequestResponseDto;

  /**
   * Convert interest entity with attached request to DTO.
   */
  static fromInterestAndRequest(
    interest: RequestInterestEntity,
    request: RequestEntity | null,
    currentServiceProviderId: string,
  ): InterestedRequestDto {
    const dto = new InterestedRequestDto();

    dto.interestId = interest.id;
    dto.interestCreatedAt = interest.createdAt;
    dto.interestMessage = interest.message;
    dto.requestId = interest.requestId;

    if (request) {
      dto.title = request.title;
      dto.description = request.description;
      dto.status = request.status;
      dto.requestCreatedAt = request.createdAt;

      const assignedToMe = request.providerId === currentServiceProviderId;
      const assignedToOther =
        request.providerId !== null && request.providerId !== currentServiceProviderId;

      dto.assignedToMe = assignedToMe;
      dto.assignedToOther = assignedToOther;

      // Include full request details if assigned to me or not assigned to anyone
      if (assignedToMe || !assignedToOther) {
        dto.fullRequest = RequestResponseDto.fromEntity(request);
      }
    } else {
      // Request not found (shouldn't happen, but handle gracefully)
      dto.title = 'Request not found';
      dto.description = '';
      dto.status = RequestStatus.CANCELLED;
      dto.requestCreatedAt = interest.createdAt;
      dto.assignedToMe = false;
      dto.assignedToOther = false;
    }

    return dto;
  }

  /**
   * Convert multiple interests with requests to DTOs.
   */
  static fromInterestsWithRequests(
    interests: RequestInterestEntity[],
    currentServiceProviderId: string,
  ): InterestedRequestDto[] {
    return interests.map((interest) => {
      const request = (interest as any).request as RequestEntity | null;
      return InterestedRequestDto.fromInterestAndRequest(
        interest,
        request,
        currentServiceProviderId,
      );
    });
  }
}

