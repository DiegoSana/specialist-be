import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfessionalDto {
  @ApiProperty({
    example: ['uuid-of-trade-1', 'uuid-of-trade-2'],
    required: false,
    description: 'Array of trade IDs. First one will be primary.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tradeIds?: string[];

  @ApiProperty({
    example: 'Experienced electrician with 10+ years...',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experienceYears?: number;

  @ApiProperty({ example: 'Centro', required: false })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiProperty({ example: 'Bariloche', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Av. San Martín 123', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'https://example.com', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg', required: false })
  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @ApiProperty({ example: ['https://example.com/img1.jpg'], required: false })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  gallery?: string[];
}
