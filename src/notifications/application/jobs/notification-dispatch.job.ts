import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

@Injectable()
export class NotificationDispatchJob {
  constructor(private readonly dispatch: NotificationDispatchService) {}

  // Every minute
  @Cron('*/1 * * * *')
  async run(): Promise<void> {
    await this.dispatch.dispatchPending();
  }
}

