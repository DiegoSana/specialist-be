import { Injectable } from '@nestjs/common';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { StatusFollowUpRule } from './status-follow-up-rule';

/** Follow-up: request ACCEPTED 7 days ago, reminder to provider. */
@Injectable()
export class Accepted7DaysFollowUpRule extends StatusFollowUpRule {
  constructor() {
    super(
      'ACCEPTED_7_DAYS',
      RequestStatus.ACCEPTED,
      7,
      InteractionDirection.TO_PROVIDER,
      'follow_up_7_days',
    );
  }
}
