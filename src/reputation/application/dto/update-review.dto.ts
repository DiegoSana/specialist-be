import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ example: 'Excellent work! Very professional.', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

