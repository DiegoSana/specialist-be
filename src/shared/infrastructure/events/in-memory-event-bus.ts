import { EventEmitter } from 'events';
import { DomainEvent } from '../../domain/events/domain-event';
import { EventBus } from '../../domain/events/event-bus';

/**
 * Minimal in-process event bus.
 *
 * - Useful for decoupling bounded contexts without infrastructure yet.
 * - Later you can replace this with an Outbox + queue-based implementation.
 */
export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  async publish(event: DomainEvent): Promise<void> {
    this.emitter.emit(event.name, event);
    this.emitter.emit('*', event);
  }

  // Note: not part of the EventBus port yet; kept for infra wiring/tests.
  on<T extends DomainEvent = DomainEvent>(
    name: string,
    handler: (event: T) => void | Promise<void>,
  ): void {
    this.emitter.on(name, handler);
  }
}

