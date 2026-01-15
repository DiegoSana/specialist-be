import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { ProviderType } from '@prisma/client';

export type ReviewApprovedPayload = {
  reviewId: string;
  reviewerId: string;
  /** @deprecated Use serviceProviderId instead */
  professionalId: string;
  /** The ServiceProvider ID */
  serviceProviderId: string;
  /** The userId of the provider (Professional or Company owner) */
  providerUserId: string;
  /** The type of provider */
  providerType: ProviderType;
  rating: number;
  comment: string | null;
  moderatorId: string;
};

export class ReviewApprovedEvent implements DomainEvent<ReviewApprovedPayload> {
  public static readonly EVENT_NAME = 'reputation.review.approved';

  public readonly name = ReviewApprovedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: ReviewApprovedPayload) {}
}

