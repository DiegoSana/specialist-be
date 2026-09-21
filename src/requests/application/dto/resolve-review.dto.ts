import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveReviewDto {
  @ApiProperty({
    example: 'Se contactó a ambas partes; el trabajo se dio por cumplido.',
    required: false,
    description: 'Optional resolution note, stored as the request statusReason',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
