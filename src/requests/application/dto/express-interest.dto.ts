import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExpressInterestDto {
  @ApiProperty({
    example: 'Tengo experiencia en este tipo de trabajos...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class AssignProfessionalDto {
  @ApiProperty({ example: 'uuid-of-professional' })
  @IsString()
  professionalId: string;
}
