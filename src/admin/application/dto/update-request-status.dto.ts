import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @ApiProperty({
    example: 'No llegamos a un acuerdo en el alcance del trabajo.',
    required: false,
    description:
      'Reason recorded for the transition (mirrors UpdateRequestDto.statusReason)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusReason?: string;
}
