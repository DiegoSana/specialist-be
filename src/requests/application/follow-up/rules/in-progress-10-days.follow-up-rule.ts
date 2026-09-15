import { Injectable } from '@nestjs/common';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { StatusFollowUpRule } from './status-follow-up-rule';

/** Follow-up: request IN_PROGRESS 10 days, ask provider if they need help. */
@Injectable()
export class InProgress10DaysFollowUpRule extends StatusFollowUpRule {
  constructor() {
    super(
      'IN_PROGRESS_10_DAYS',
      RequestStatus.IN_PROGRESS,
      10,
      InteractionDirection.TO_PROVIDER,
      'follow_up_10_days_in_progress',
    );
  }
}
