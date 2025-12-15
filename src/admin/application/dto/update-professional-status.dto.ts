import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProfessionalStatus } from '@prisma/client';

export class UpdateProfessionalStatusDto {
  @ApiProperty({ enum: ProfessionalStatus })
  @IsEnum(ProfessionalStatus)
  status: ProfessionalStatus;
}

