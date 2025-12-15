import { IsString, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AddRequestPhotoDto {
  @ApiProperty({ example: 'https://example.com/work-photo.jpg', description: 'URL of the photo or video to add to the request' })
  @IsNotEmpty({ message: 'url is required' })
  @IsString({ message: 'url must be a string' })
  @Transform(({ value }) => {
    // Ensure the URL is a string and trim whitespace
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsUrl(
    {
      require_protocol: true,
      require_valid_protocol: true,
      require_tld: false, // Allow localhost and other non-TLD hosts
      protocols: ['http', 'https'],
    },
    { message: 'url must be a valid URL address' }
  )
  url: string;
}

