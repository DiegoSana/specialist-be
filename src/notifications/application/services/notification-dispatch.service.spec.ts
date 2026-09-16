import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationDispatchService } from './notification-dispatch.service';
import { EMAIL_SENDER } from '../../domain/ports/email-sender';
import { NOTIFICATION_DELIVERY_QUEUE } from '../../domain/ports/notification-delivery-queue';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let mockEmailSender: { send: jest.Mock };
  let mockQueue: {
    takePendingDeliveries: jest.Mock;
    markSent: jest.Mock;
    markRetry: jest.Mock;
    markFailedPermanently: jest.Mock;
  };
  let configValues: Record<string, string>;

  const pendingDelivery = {
    deliveryId: 'delivery-1',
    channel: NotificationChannel.EMAIL,
    attemptCount: 0,
    nextAttemptAt: null,
    notification: {
      id: 'notif-1',
      userId: 'user-1',
      userEmail: 'user@example.com',
      type: 'REQUEST_STATUS_CHANGED',
      title: 'Title',
      body: 'Body',
      data: null,
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    configValues = {
      NOTIFICATIONS_DISPATCH_ENABLED: 'true',
      EMAIL_PROVIDER: 'smtp',
      NOTIFICATIONS_SMTP_HOST: 'smtp.example.com',
      NOTIFICATIONS_SMTP_FROM: 'noreply@example.com',
    };

    mockEmailSender = { send: jest.fn().mockResolvedValue(null) };
    mockQueue = {
      takePendingDeliveries: jest.fn().mockResolvedValue([]),
      markSent: jest.fn().mockResolvedValue(undefined),
      markRetry: jest.fn().mockResolvedValue(undefined),
      markFailedPermanently: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationDispatchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, def?: string) => configValues[key] ?? def,
            ),
          },
        },
        { provide: EMAIL_SENDER, useValue: mockEmailSender },
        { provide: NOTIFICATION_DELIVERY_QUEUE, useValue: mockQueue },
      ],
    }).compile();

    service = module.get(NotificationDispatchService);
  });

  it('does nothing when NOTIFICATIONS_DISPATCH_ENABLED is not true', async () => {
    configValues.NOTIFICATIONS_DISPATCH_ENABLED = 'false';

    await service.dispatchPending();

    expect(mockQueue.takePendingDeliveries).not.toHaveBeenCalled();
  });

  it('skips dispatch when EMAIL_PROVIDER=smtp and SMTP host/from are missing', async () => {
    delete configValues.NOTIFICATIONS_SMTP_HOST;

    await service.dispatchPending();

    expect(mockQueue.takePendingDeliveries).not.toHaveBeenCalled();
  });

  it('dispatches when EMAIL_PROVIDER=ethereal even without SMTP host/from configured', async () => {
    configValues.EMAIL_PROVIDER = 'ethereal';
    delete configValues.NOTIFICATIONS_SMTP_HOST;
    delete configValues.NOTIFICATIONS_SMTP_FROM;
    mockQueue.takePendingDeliveries.mockResolvedValue([pendingDelivery]);

    await service.dispatchPending();

    expect(mockQueue.takePendingDeliveries).toHaveBeenCalled();
  });

  it("passes the emailSender's returned id through to markSent", async () => {
    mockQueue.takePendingDeliveries.mockResolvedValue([pendingDelivery]);
    mockEmailSender.send.mockResolvedValue(
      'https://ethereal.email/message/abc123',
    );

    await service.dispatchPending();

    expect(mockQueue.markSent).toHaveBeenCalledWith(
      'delivery-1',
      expect.any(Date),
      'https://ethereal.email/message/abc123',
    );
  });

  it('passes null through to markSent when the sender returns no id', async () => {
    mockQueue.takePendingDeliveries.mockResolvedValue([pendingDelivery]);
    mockEmailSender.send.mockResolvedValue(null);

    await service.dispatchPending();

    expect(mockQueue.markSent).toHaveBeenCalledWith(
      'delivery-1',
      expect.any(Date),
      null,
    );
  });

  it('retries with backoff when the send fails', async () => {
    mockQueue.takePendingDeliveries.mockResolvedValue([pendingDelivery]);
    mockEmailSender.send.mockRejectedValue(new Error('boom'));

    await service.dispatchPending();

    expect(mockQueue.markRetry).toHaveBeenCalled();
    expect(mockQueue.markSent).not.toHaveBeenCalled();
  });
});
