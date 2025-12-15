import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: 'uuid-of-target-user' })
  @IsString()
  toUserId: string;

  @ApiProperty({ example: 'whatsapp', required: false, default: 'whatsapp' })
  @IsOptional()
  @IsString()
  contactType?: string;

  @ApiProperty({ example: 'Hello, I would like to contact you...', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

