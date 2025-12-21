import { IsString, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddGalleryItemDto {
  @ApiProperty({
    example: 'https://example.com/image.jpg',
    description: 'URL of the image or video to add to gallery',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl({ require_tld: false }) // Allow localhost and other non-TLD hosts
  url: string;
}
