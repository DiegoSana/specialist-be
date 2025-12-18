import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchProfessionalsDto {
  @ApiProperty({ example: 'electricista', required: false, description: 'Search by trade name or professional name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ example: 'uuid-of-trade', required: false, description: 'Filter by trade ID' })
  @IsOptional()
  @IsString()
  tradeId?: string;
}

