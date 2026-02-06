import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserVerificationDto {
  @ApiPropertyOptional({
    description: 'Set email as verified (admin manual confirmation)',
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Set phone as verified (admin manual confirmation)',
  })
  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;
}
