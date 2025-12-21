import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({
    example: 'uuid-of-professional',
    required: false,
    description: 'Required for direct requests',
  })
  @ValidateIf((o) => !o.isPublic)
  @IsString()
  @IsNotEmpty({ message: 'professionalId is required for direct requests' })
  professionalId?: string;

  @ApiProperty({
    example: 'uuid-of-trade',
    required: false,
    description: 'Required for public requests',
  })
  @ValidateIf((o) => o.isPublic)
  @IsString()
  @IsNotEmpty({ message: 'tradeId is required for public requests' })
  tradeId?: string;

  @ApiProperty({
    example: false,
    description: 'If true, request is public and visible to all specialists',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ example: 'I need electrical work done in my house...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Av. San Martín 123', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Monday to Friday, 9am to 6pm', required: false })
  @IsOptional()
  @IsString()
  availability?: string;

  @ApiProperty({ example: ['https://example.com/photo1.jpg'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
