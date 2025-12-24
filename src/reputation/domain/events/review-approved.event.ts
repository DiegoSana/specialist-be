import { DomainEvent } from '../../../shared/domain/events/domain-event';

export type ReviewApprovedPayload = {
  reviewId: string;
  reviewerId: string;
  professionalId: string;
  professionalUserId: string;
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

