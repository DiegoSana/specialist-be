import { ContactEntity } from '../entities/contact.entity';

/**
 * Append-only store de contactos (log). No hay updates: un Contact es un hecho ocurrido.
 * En DDD estricto suele verse como "event log" o "communication log".
 */
export interface ContactRepository {
  create(
    contact: Omit<ContactEntity, 'id' | 'createdAt'>,
  ): Promise<ContactEntity>;
  findByUserId(userId: string): Promise<ContactEntity[]>;
}

// Token for dependency injection
export const CONTACT_REPOSITORY = Symbol('ContactRepository');
