import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FeatureReviewDto {
  @ApiProperty({
    example: true,
    description:
      'Whether this (approved) review should be curated as a featured comment',
  })
  @IsBoolean()
  isFeatured: boolean;
}
