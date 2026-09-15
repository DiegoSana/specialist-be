import { Injectable } from '@nestjs/common';
import { InteractionDirection, RequestStatus } from '@prisma/client';
import { StatusFollowUpRule } from './status-follow-up-rule';

/** Follow-up: request DONE 1 day ago, ask client for review. */
@Injectable()
export class Done1DayFollowUpRule extends StatusFollowUpRule {
  constructor() {
    super(
      'DONE_1_DAY',
      RequestStatus.DONE,
      1,
      InteractionDirection.TO_CLIENT,
      'follow_up_review_1_day',
    );
  }
}
