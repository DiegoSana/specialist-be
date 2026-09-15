import { Injectable } from '@nestjs/common';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { StatusFollowUpRule } from './status-follow-up-rule';

/** Follow-up: request IN_PROGRESS 5 days, ask provider how it's going. */
@Injectable()
export class InProgress5DaysFollowUpRule extends StatusFollowUpRule {
  constructor() {
    super(
      'IN_PROGRESS_5_DAYS',
      RequestStatus.IN_PROGRESS,
      5,
      InteractionDirection.TO_PROVIDER,
      'follow_up_5_days_in_progress',
    );
  }
}
