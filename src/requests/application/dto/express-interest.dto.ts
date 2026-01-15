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
 * @deprecated Use AssignProviderDto instead
 */
export class AssignProfessionalDto {
  @ApiProperty({
    example: 'uuid-of-professional',
    description: 'The Professional ID to assign (deprecated, use serviceProviderId)',
  })
  @IsString()
  professionalId: string;
}
