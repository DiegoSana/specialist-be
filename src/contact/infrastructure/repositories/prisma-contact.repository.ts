import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ContactRepository } from '../../domain/repositories/contact.repository';
import { ContactEntity } from '../../domain/entities/contact.entity';
import { PrismaContactMapper } from '../mappers/contact.prisma-mapper';

@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    contactData: Omit<ContactEntity, 'id' | 'createdAt'>,
  ): Promise<ContactEntity> {
    const contact = await this.prisma.contact.create({
      data: {
        ...PrismaContactMapper.toPersistenceCreate(contactData),
      },
    });

    return PrismaContactMapper.toDomain(contact);
  }

  async findByUserId(userId: string): Promise<ContactEntity[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => PrismaContactMapper.toDomain(c));
  }
}
