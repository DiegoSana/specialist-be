export type InAppNotificationProps = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  readAt: Date | null;
  createdAt: Date;
};

export class InAppNotificationEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly body: string | null,
    public readonly data: Record<string, any> | null,
    public readonly readAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  isRead(): boolean {
    return this.readAt !== null;
  }

  markRead(now = new Date()): InAppNotificationEntity {
    if (this.isRead()) return this;
    return new InAppNotificationEntity(
      this.id,
      this.userId,
      this.type,
      this.title,
      this.body,
      this.data,
      now,
      this.createdAt,
    );
  }

  static create(input: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body?: string | null;
    data?: Record<string, any> | null;
    now?: Date;
  }): InAppNotificationEntity {
    const now = input.now ?? new Date();
    return new InAppNotificationEntity(
      input.id,
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      input.data ?? null,
      null,
      now,
    );
  }
}
