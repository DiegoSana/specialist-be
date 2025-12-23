import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExternalNotificationChannel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Enable/disable in-app notifications globally' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable external notifications globally (email/whatsapp)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  externalEnabled?: boolean;

  @ApiPropertyOptional({ enum: ExternalNotificationChannel, description: 'Preferred external channel' })
  @IsOptional()
  @IsEnum(ExternalNotificationChannel)
  preferredExternalChannel?: ExternalNotificationChannel;

  @ApiPropertyOptional({
    description:
      'Per-type overrides object keyed by notification type (free-form JSON)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, any>;
}

