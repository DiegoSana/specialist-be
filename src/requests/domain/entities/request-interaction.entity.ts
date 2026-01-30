import {
  InteractionType,
  InteractionStatus,
  InteractionDirection,
  ResponseIntent,
} from '@prisma/client';

export class RequestInteractionEntity {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly interactionType: InteractionType,
    public readonly status: InteractionStatus,
    public readonly direction: InteractionDirection,
    public readonly channel: string,
    public readonly messageTemplate: string,
    public readonly messageContent: string,
    public readonly responseContent: string | null,
    public readonly responseIntent: ResponseIntent | null,
    public readonly scheduledFor: Date,
    public readonly sentAt: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly respondedAt: Date | null,
    public readonly twilioMessageSid: string | null,
    public readonly twilioStatus: string | null,
    public readonly metadata: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static createPending(params: {
    id: string;
    requestId: string;
    interactionType: InteractionType;
    direction: InteractionDirection;
    channel: string;
    messageTemplate: string;
    messageContent: string;
    scheduledFor: Date;
    metadata?: Record<string, unknown>;
    now?: Date;
  }): RequestInteractionEntity {
    const now = params.now ?? new Date();
    return new RequestInteractionEntity(
      params.id,
      params.requestId,
      params.interactionType,
      InteractionStatus.PENDING,
      params.direction,
      params.channel,
      params.messageTemplate,
      params.messageContent,
      null, // responseContent
      null, // responseIntent
      params.scheduledFor,
      null, // sentAt
      null, // deliveredAt
      null, // respondedAt
      null, // twilioMessageSid
      null, // twilioStatus
      params.metadata ?? null,
      now,
      now,
    );
  }

  isPending(): boolean {
    return this.status === InteractionStatus.PENDING;
  }

  isSent(): boolean {
    return this.status === InteractionStatus.SENT;
  }

  isDelivered(): boolean {
    return this.status === InteractionStatus.DELIVERED;
  }

  isResponded(): boolean {
    return this.status === InteractionStatus.RESPONDED;
  }

  isFailed(): boolean {
    return this.status === InteractionStatus.FAILED;
  }

  markAsSent(twilioMessageSid: string, now?: Date): RequestInteractionEntity {
    if (!this.isPending()) {
      throw new Error(
        `Cannot mark as sent: interaction is not pending (current status: ${this.status})`,
      );
    }

    const updateTime = now ?? new Date();
    return new RequestInteractionEntity(
      this.id,
      this.requestId,
      this.interactionType,
      InteractionStatus.SENT,
      this.direction,
      this.channel,
      this.messageTemplate,
      this.messageContent,
      this.responseContent,
      this.responseIntent,
      this.scheduledFor,
      updateTime,
      this.deliveredAt,
      this.respondedAt,
      twilioMessageSid,
      this.twilioStatus,
      this.metadata,
      this.createdAt,
      updateTime,
    );
  }

  markAsDelivered(
    twilioStatus: string,
    now?: Date,
  ): RequestInteractionEntity {
    if (!this.isSent()) {
      throw new Error(
        `Cannot mark as delivered: interaction is not sent (current status: ${this.status})`,
      );
    }

    const updateTime = now ?? new Date();
    return new RequestInteractionEntity(
      this.id,
      this.requestId,
      this.interactionType,
      InteractionStatus.DELIVERED,
      this.direction,
      this.channel,
      this.messageTemplate,
      this.messageContent,
      this.responseContent,
      this.responseIntent,
      this.scheduledFor,
      this.sentAt,
      updateTime,
      this.respondedAt,
      this.twilioMessageSid,
      twilioStatus,
      this.metadata,
      this.createdAt,
      updateTime,
    );
  }

  markAsResponded(
    responseContent: string,
    responseIntent: ResponseIntent,
    now?: Date,
  ): RequestInteractionEntity {
    if (this.isResponded()) {
      throw new Error('Interaction already has a response');
    }

    const updateTime = now ?? new Date();
    return new RequestInteractionEntity(
      this.id,
      this.requestId,
      this.interactionType,
      InteractionStatus.RESPONDED,
      this.direction,
      this.channel,
      this.messageTemplate,
      this.messageContent,
      responseContent,
      responseIntent,
      this.scheduledFor,
      this.sentAt,
      this.deliveredAt ?? updateTime,
      updateTime,
      this.twilioMessageSid,
      this.twilioStatus,
      this.metadata,
      this.createdAt,
      updateTime,
    );
  }

  markAsFailed(now?: Date): RequestInteractionEntity {
    if (this.isResponded() || this.isFailed()) {
      throw new Error(
        `Cannot mark as failed: interaction is already in terminal state (current status: ${this.status})`,
      );
    }

    const updateTime = now ?? new Date();
    return new RequestInteractionEntity(
      this.id,
      this.requestId,
      this.interactionType,
      InteractionStatus.FAILED,
      this.direction,
      this.channel,
      this.messageTemplate,
      this.messageContent,
      this.responseContent,
      this.responseIntent,
      this.scheduledFor,
      this.sentAt,
      this.deliveredAt,
      this.respondedAt,
      this.twilioMessageSid,
      this.twilioStatus,
      this.metadata,
      this.createdAt,
      updateTime,
    );
  }
}

