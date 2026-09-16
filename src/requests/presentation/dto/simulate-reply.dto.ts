import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SimulateReplyDto {
  @ApiProperty({
    example: 'Confirmo, ya empecé el trabajo',
    description: 'Text of the simulated inbound WhatsApp reply',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;
}
