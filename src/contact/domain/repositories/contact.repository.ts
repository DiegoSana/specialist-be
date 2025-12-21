import { ContactEntity } from '../entities/contact.entity';

export interface ContactRepository {
  create(
    contact: Omit<ContactEntity, 'id' | 'createdAt'>,
  ): Promise<ContactEntity>;
  findByUserId(userId: string): Promise<ContactEntity[]>;
}

// Token for dependency injection
export const CONTACT_REPOSITORY = Symbol('ContactRepository');
