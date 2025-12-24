import { EventEmitter } from 'events';
<<<<<<< HEAD
import { Logger } from '@nestjs/common';
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
  private readonly logger = new Logger(InMemoryEventBus.name);
=======
>>>>>>> origin/main

  async publish(event: DomainEvent): Promise<void> {
    this.emitter.emit(event.name, event);
    this.emitter.emit('*', event);
  }

  // Note: not part of the EventBus port yet; kept for infra wiring/tests.
  on<T extends DomainEvent = DomainEvent>(
    name: string,
    handler: (event: T) => void | Promise<void>,
  ): void {
<<<<<<< HEAD
    this.emitter.on(name, (event: T) => {
      try {
        const result = handler(event);

        // EventEmitter doesn't await async listeners. If a handler returns a promise,
        // attach a rejection handler so errors don't become unhandled rejections.
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch((err) => {
            this.logger.error(
              `Event handler failed (event="${name}")`,
              err instanceof Error ? err.stack : String(err),
            );
          });
        }
      } catch (err) {
        // Catch synchronous throws too.
        this.logger.error(
          `Event handler threw (event="${name}")`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    });
=======
    this.emitter.on(name, handler);
>>>>>>> origin/main
  }
}

