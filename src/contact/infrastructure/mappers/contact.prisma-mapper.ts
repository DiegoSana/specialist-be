import { ContactEntity } from '../../domain/entities/contact.entity';
import { Prisma } from '@prisma/client';

export class PrismaContactMapper {
  static toDomain(contact: any): ContactEntity {
    return new ContactEntity(
      contact.id,
      contact.fromUserId,
      contact.toUserId,
      contact.contactType,
      contact.message,
      contact.createdAt,
    );
  }

  static toPersistenceCreate(
    input: Omit<ContactEntity, 'id' | 'createdAt'>,
  ): Prisma.ContactUncheckedCreateInput {
    return {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      contactType: input.contactType,
      message: input.message,
    };
  }
}
