import { DomainEvent } from './domain-event';

export interface EventBus {
  publish(event: DomainEvent): void | Promise<void>;
}

// Token for dependency injection (ports & adapters)
export const EVENT_BUS = Symbol('EventBus');
