import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExpressInterestDto {
  @ApiProperty({
    example: 'Tengo experiencia en este tipo de trabajos...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/**
 * DTO for assigning a provider to a request.
 * Can be a Professional or Company (via their serviceProviderId).
 */
export class AssignProviderDto {
  @ApiProperty({
    example: 'uuid-of-service-provider',
    description: 'The ServiceProvider ID of the provider to assign',
  })
  @IsString()
  serviceProviderId: string;
}

/**
 * @deprecated Removed - Use AssignProviderDto instead
 * This DTO was removed in favor of AssignProviderDto which works for both Professionals and Companies.
 */
