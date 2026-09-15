import { Injectable } from '@nestjs/common';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { StatusFollowUpRule } from './status-follow-up-rule';

/** Follow-up: request ACCEPTED 3 days ago, ask provider if they started. */
@Injectable()
export class Accepted3DaysFollowUpRule extends StatusFollowUpRule {
  constructor() {
    super(
      'ACCEPTED_3_DAYS',
      RequestStatus.ACCEPTED,
      3,
      InteractionDirection.TO_PROVIDER,
      'follow_up_3_days',
    );
  }
}
