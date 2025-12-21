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

  async create(clientData: {
    userId: string;
    preferences?: Record<string, any> | null;
    savedProfessionals?: string[];
    searchHistory?: Record<string, any> | null;
    notificationSettings?: Record<string, any> | null;
  }): Promise<ClientEntity> {
    const client = await this.prisma.client.create({
      data: {
        ...PrismaClientMapper.toPersistenceCreate(clientData),
      },
    });

    return PrismaClientMapper.toDomain(client);
  }

  async update(id: string, data: Partial<ClientEntity>): Promise<ClientEntity> {
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...PrismaClientMapper.toPersistenceUpdate(data),
      },
    });

    return PrismaClientMapper.toDomain(client);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.delete({
      where: { id },
    });
  }
}
