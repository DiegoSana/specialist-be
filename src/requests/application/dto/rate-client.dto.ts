import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateClientDto {
  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Rating from 1 to 5',
  })
  @IsNumber()
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating: number;

  @ApiPropertyOptional({
    example: 'Great client, paid on time.',
    maxLength: 500,
    description: 'Optional comment about the client',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Comment must be at most 500 characters' })
  comment?: string;
}
