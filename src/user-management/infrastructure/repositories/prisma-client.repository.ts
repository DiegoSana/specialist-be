import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ClientRepository } from '../../domain/repositories/client.repository';
import { ClientEntity } from '../../domain/entities/client.entity';

@Injectable()
export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ClientEntity | null> {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) return null;

    return this.toEntity(client);
  }

  async findByUserId(userId: string): Promise<ClientEntity | null> {
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client) return null;

    return this.toEntity(client);
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
        userId: clientData.userId,
        preferences: clientData.preferences || null,
        savedProfessionals: clientData.savedProfessionals || [],
        searchHistory: clientData.searchHistory || null,
        notificationSettings: clientData.notificationSettings || null,
      },
    });

    return this.toEntity(client);
  }

  async update(id: string, data: Partial<ClientEntity>): Promise<ClientEntity> {
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(data.preferences !== undefined && { preferences: data.preferences }),
        ...(data.savedProfessionals !== undefined && { savedProfessionals: data.savedProfessionals }),
        ...(data.searchHistory !== undefined && { searchHistory: data.searchHistory }),
        ...(data.notificationSettings !== undefined && { notificationSettings: data.notificationSettings }),
      },
    });

    return this.toEntity(client);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.delete({
      where: { id },
    });
  }

  private toEntity(client: any): ClientEntity {
    return new ClientEntity(
      client.id,
      client.userId,
      client.preferences as Record<string, any> | null,
      client.savedProfessionals as string[],
      client.searchHistory as Record<string, any> | null,
      client.notificationSettings as Record<string, any> | null,
      client.createdAt,
      client.updatedAt,
    );
  }
}

