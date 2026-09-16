import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerFollowUpDto {
  @ApiProperty({
    example: 'ACCEPTED_3_DAYS',
    description: 'Name of the follow-up rule to force-trigger right now',
  })
  @IsString()
  @IsNotEmpty()
  ruleName: string;
}
