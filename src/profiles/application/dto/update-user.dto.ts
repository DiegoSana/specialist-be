import { IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'Juan', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Pérez', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+5492944123456', required: false })
  @IsOptional()
  @ValidateIf(
    (o) => o.phone !== undefined && o.phone !== null && o.phone !== '',
  )
  @IsString()
  phone?: string;

  @ApiProperty({
    example:
      'http://localhost:5000/api/storage/public/profile-pictures/user123/abc.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;
}
