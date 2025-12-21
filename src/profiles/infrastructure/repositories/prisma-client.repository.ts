import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ClientRepository } from '../../domain/repositories/client.repository';
import { ClientEntity } from '../../domain/entities/client.entity';
import { PrismaClientMapper } from '../mappers/client.prisma-mapper';

@Injectable()
export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ClientEntity | null> {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) return null;

    return PrismaClientMapper.toDomain(client);
  }

  async findByUserId(userId: string): Promise<ClientEntity | null> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client) return null;

    return PrismaClientMapper.toDomain(client);
  }

  async save(client: ClientEntity): Promise<ClientEntity> {
    const persistence = PrismaClientMapper.toPersistenceSave(client);

    const saved = await this.prisma.client.upsert({
      where: { id: client.id },
      create: {
        id: client.id,
        ...(persistence as any),
      },
      update: {
        ...(persistence as any),
      },
    });

    return PrismaClientMapper.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.delete({
      where: { id },
    });
  }
}
