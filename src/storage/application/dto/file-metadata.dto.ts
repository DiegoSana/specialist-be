import { ApiProperty } from '@nestjs/swagger';
import { FileCategory } from '../../domain/value-objects/file-category.vo';

export class FileMetadataDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  originalFilename: string;

  @ApiProperty()
  storedFilename: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ enum: FileCategory })
  category: FileCategory;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty({ required: false })
  ownerId?: string;

  @ApiProperty({ required: false })
  requestId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
