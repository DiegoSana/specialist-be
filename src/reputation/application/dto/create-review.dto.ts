import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: 'uuid-of-professional' })
  @IsString()
  professionalId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    example: 'Excellent work! Very professional.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ example: 'uuid-of-request', required: false })
  @IsOptional()
  @IsString()
  requestId?: string;
}
