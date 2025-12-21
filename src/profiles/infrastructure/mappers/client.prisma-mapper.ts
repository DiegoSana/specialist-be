import { ClientEntity } from '../../domain/entities/client.entity';

export class PrismaClientMapper {
  static toDomain(client: any): ClientEntity {
    return new ClientEntity(
      client.id,
      client.userId,
      (client.preferences as Record<string, any> | null) ?? null,
      (client.savedProfessionals as string[]) ?? [],
      (client.searchHistory as Record<string, any> | null) ?? null,
      (client.notificationSettings as Record<string, any> | null) ?? null,
      client.createdAt,
      client.updatedAt,
    );
  }

  static toPersistenceCreate(input: {
    userId: string;
    preferences?: Record<string, any> | null;
    savedProfessionals?: string[];
    searchHistory?: Record<string, any> | null;
    notificationSettings?: Record<string, any> | null;
  }): Record<string, unknown> {
    return {
      userId: input.userId,
      preferences: input.preferences ?? null,
      savedProfessionals: input.savedProfessionals ?? [],
      searchHistory: input.searchHistory ?? null,
      notificationSettings: input.notificationSettings ?? null,
    };
  }

  static toPersistenceUpdate(partial: Partial<ClientEntity>): Record<string, unknown> {
    return {
      ...(partial.preferences !== undefined && { preferences: partial.preferences }),
      ...(partial.savedProfessionals !== undefined && { savedProfessionals: partial.savedProfessionals }),
      ...(partial.searchHistory !== undefined && { searchHistory: partial.searchHistory }),
      ...(partial.notificationSettings !== undefined && { notificationSettings: partial.notificationSettings }),
    };
  }
}

