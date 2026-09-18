import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class AdminReplySupportConversationDto {
  @ApiProperty({
    example: 'Hola! Ya te ayudamos con eso, un momento por favor.',
    description: 'Free-text WhatsApp reply, 1-1500 characters.',
    minLength: 1,
    maxLength: 1500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  message: string;
}
