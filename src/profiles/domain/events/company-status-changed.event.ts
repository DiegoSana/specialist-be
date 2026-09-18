import { DomainEvent } from '../../../shared/domain/events/domain-event';
import { CompanyStatus } from '../entities/company.entity';

export interface CompanyStatusChangedPayload {
  companyId: string;
  userId: string;
  companyName: string;
  previousStatus: CompanyStatus;
  newStatus: CompanyStatus;
}

/**
 * Published when an admin changes a Company's status (verification or manual status update),
 * only if the status actually changed. Consumed by the Notifications context to tell the
 * owner about the outcome (see CompanyStatusChangedHandler).
 */
export class CompanyStatusChangedEvent
  implements DomainEvent<CompanyStatusChangedPayload>
{
  public static readonly EVENT_NAME = 'profiles.company.status_changed';

  public readonly name = CompanyStatusChangedEvent.EVENT_NAME;
  public readonly occurredAt = new Date();

  constructor(public readonly payload: CompanyStatusChangedPayload) {}
}
