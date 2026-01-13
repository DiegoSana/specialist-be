import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel';
import { ExternalNotificationChannel } from '../../domain/value-objects/external-notification-channel';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockRepo: jest.Mocked<NotificationRepository>;
  let mockPreferences: { getForUser: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      listForUser: jest.fn(),
      create: jest.fn(async (input) => input.notification),
      markInAppRead: jest.fn(),
      markAllInAppRead: jest.fn(),
      // Admin methods
      listAll: jest.fn(),
      getDeliveryStats: jest.fn(),
      markForResend: jest.fn(),
    };

    mockPreferences = {
      getForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NOTIFICATION_REPOSITORY, useValue: mockRepo },
        { provide: NotificationPreferencesService, useValue: mockPreferences },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not include IN_APP when effective.inAppEnabled is false', async () => {
    mockPreferences.getForUser.mockResolvedValue({
      effectiveFor: () => ({
        inAppEnabled: false,
        externalEnabled: true,
        preferredExternalChannel: ExternalNotificationChannel.EMAIL,
      }),
    });

    await service.createForUser({
      userId: 'user-1',
      type: 'ANY',
      title: 'Hello',
      includeExternal: true,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryChannels: [NotificationChannel.EMAIL],
        emailStatus: 'PENDING',
        whatsappStatus: 'SKIPPED',
      }),
    );
  });

  it('includes IN_APP when effective.inAppEnabled is true', async () => {
    mockPreferences.getForUser.mockResolvedValue({
      effectiveFor: () => ({
        inAppEnabled: true,
        externalEnabled: false,
        preferredExternalChannel: ExternalNotificationChannel.EMAIL,
      }),
    });

    await service.createForUser({
      userId: 'user-1',
      type: 'ANY',
      title: 'Hello',
      includeExternal: false,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryChannels: [NotificationChannel.IN_APP],
        emailStatus: 'SKIPPED',
        whatsappStatus: 'SKIPPED',
      }),
    );
  });

  it('still creates external delivery when requireExternal is true (even if external disabled)', async () => {
    mockPreferences.getForUser.mockResolvedValue({
      effectiveFor: () => ({
        inAppEnabled: false,
        externalEnabled: false,
        preferredExternalChannel: ExternalNotificationChannel.WHATSAPP,
      }),
    });

    const result = await service.createForUser({
      userId: 'user-1',
      type: 'ANY',
      title: 'Hello',
      includeExternal: true,
      requireExternal: true,
    });

    expect(result).toBeInstanceOf(NotificationEntity);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryChannels: [NotificationChannel.WHATSAPP],
        emailStatus: 'SKIPPED',
        whatsappStatus: 'PENDING',
      }),
    );
  });
});
