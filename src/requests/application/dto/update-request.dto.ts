import { IsEnum, IsOptional, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class UpdateRequestDto {
  @ApiProperty({ enum: RequestStatus, required: false })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiProperty({ example: 5000.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quoteAmount?: number;

  @ApiProperty({
    example: 'Estimated completion time: 2 weeks',
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteNotes?: string;
}
