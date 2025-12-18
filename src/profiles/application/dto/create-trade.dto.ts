import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTradeDto {
  @ApiProperty({ example: 'Electrician' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Home Services', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'Electrical installation and repair services', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

