import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsEmail,
  Min,
  Max,
  ArrayMinSize,
  IsUrl,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiPropertyOptional({ description: 'Legal/registered name' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ description: 'Tax ID (CUIT/RUT)' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ description: 'Trade IDs the company works in', type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one trade is required' })
  @IsString({ each: true })
  tradeIds: string[];

  @ApiPropertyOptional({ description: 'Company description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Year the company was founded' })
  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ description: 'Number of employees range (e.g., "1-5", "6-20", "21-50", "50+")' })
  @IsOptional()
  @IsString()
  employeeCount?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City', default: 'Bariloche' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Zone/neighborhood' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Gallery image URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];
}

