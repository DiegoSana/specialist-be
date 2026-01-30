import {
  InteractionType,
  InteractionDirection,
} from '@prisma/client';

export class CreateFollowUpDto {
  requestId: string;
  interactionType: InteractionType;
  direction: InteractionDirection;
  messageTemplate: string;
  scheduledFor: Date;
  metadata?: Record<string, unknown>;
}

