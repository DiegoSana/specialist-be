import { ExternalNotificationChannel } from '../value-objects/external-notification-channel';

export type NotificationTypeOverride = {
  inAppEnabled?: boolean;
  externalEnabled?: boolean;
  preferredExternalChannel?: ExternalNotificationChannel;
};

export class NotificationPreferencesEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly inAppEnabled: boolean,
    public readonly externalEnabled: boolean,
    public readonly preferredExternalChannel: ExternalNotificationChannel,
    public readonly overrides: Record<string, NotificationTypeOverride> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Resolve effective settings for a notification type by applying overrides.
   */
  effectiveFor(type: string): {
    inAppEnabled: boolean;
    externalEnabled: boolean;
    preferredExternalChannel: ExternalNotificationChannel;
  } {
    const o = this.overrides?.[type];
    return {
      inAppEnabled: o?.inAppEnabled ?? this.inAppEnabled,
      externalEnabled: o?.externalEnabled ?? this.externalEnabled,
      preferredExternalChannel:
        o?.preferredExternalChannel ?? this.preferredExternalChannel,
    };
  }

  static defaultsForUser(input: {
    id: string;
    userId: string;
    now?: Date;
  }): NotificationPreferencesEntity {
    const now = input.now ?? new Date();
    return new NotificationPreferencesEntity(
      input.id,
      input.userId,
      true,
      true,
      ExternalNotificationChannel.EMAIL,
      null,
      now,
      now,
    );
  }
}

