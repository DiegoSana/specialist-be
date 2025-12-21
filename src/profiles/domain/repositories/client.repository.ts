import { ClientEntity } from '../entities/client.entity';

export interface ClientRepository {
  findById(id: string): Promise<ClientEntity | null>;
  findByUserId(userId: string): Promise<ClientEntity | null>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   */
  save(client: ClientEntity): Promise<ClientEntity>;

  delete(id: string): Promise<void>;
}

// Token for dependency injection
export const CLIENT_REPOSITORY = Symbol('ClientRepository');
