import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserWhatsAppOptOutDto {
  @ApiProperty({
    description:
      'true to manually mark the user as opted out of WhatsApp (blocks new requests/interest until reversed); false to clear the flag',
  })
  @IsBoolean()
  whatsappOptedOut: boolean;
}
