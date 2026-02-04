import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanyStatus } from '@prisma/client';

export class UpdateCompanyStatusDto {
  @ApiProperty({ enum: CompanyStatus })
  @IsEnum(CompanyStatus)
  status: CompanyStatus;
}

