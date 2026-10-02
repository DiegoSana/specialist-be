import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class E2eCleanupQueryDto {
  @ApiProperty({
    example: '[E2E]',
    description:
      'Delete every Request whose title starts with this prefix (case-sensitive), cascading to its RequestInterest/Review/RequestAttentionFlag/RequestInteraction rows',
  })
  @IsString()
  @IsNotEmpty()
  titlePrefix: string;
}
