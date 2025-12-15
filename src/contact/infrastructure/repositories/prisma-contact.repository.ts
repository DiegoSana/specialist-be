import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ContactRepository } from '../../domain/repositories/contact.repository';
import { ContactEntity } from '../../domain/entities/contact.entity';

@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    contactData: Omit<ContactEntity, 'id' | 'createdAt'>,
  ): Promise<ContactEntity> {
    const contact = await this.prisma.contact.create({
      data: {
        fromUserId: contactData.fromUserId,
        toUserId: contactData.toUserId,
        contactType: contactData.contactType,
        message: contactData.message,
      },
    });

    return this.toEntity(contact);
  }

  async findByUserId(userId: string): Promise<ContactEntity[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => this.toEntity(c));
  }

  private toEntity(contact: any): ContactEntity {
    return new ContactEntity(
      contact.id,
      contact.fromUserId,
      contact.toUserId,
      contact.contactType,
      contact.message,
      contact.createdAt,
    );
  }
}

