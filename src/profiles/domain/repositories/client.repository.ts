import { ClientEntity } from '../entities/client.entity';

export interface ClientRepository {
  findById(id: string): Promise<ClientEntity | null>;
  findByUserId(userId: string): Promise<ClientEntity | null>;
  create(client: {
    userId: string;
    preferences?: Record<string, any> | null;
    savedProfessionals?: string[];
    searchHistory?: Record<string, any> | null;
    notificationSettings?: Record<string, any> | null;
  }): Promise<ClientEntity>;
  update(id: string, data: Partial<ClientEntity>): Promise<ClientEntity>;
  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const CLIENT_REPOSITORY = Symbol('ClientRepository');
