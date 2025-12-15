import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory } from '../../domain/value-objects/file-category.vo';

export class UploadFileDto {
  @ApiProperty({
    enum: FileCategory,
    description: 'Category of the file',
    example: FileCategory.PROFILE_PICTURE,
  })
  @IsEnum(FileCategory)
  category: FileCategory;

  @ApiPropertyOptional({
    description: 'Request ID if this is a request photo',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;
}

