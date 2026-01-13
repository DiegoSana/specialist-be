import { RequestEntity } from '../entities/request.entity';

export interface RequestRepository {
  findById(id: string): Promise<RequestEntity | null>;
  findByClientId(clientId: string): Promise<RequestEntity[]>;
  findByProviderId(providerId: string): Promise<RequestEntity[]>;
  findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]>;
  findAvailableForProfessional(
    tradeIds: string[],
    city?: string,
    zone?: string,
  ): Promise<RequestEntity[]>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación decide create vs update.
   */
  save(request: RequestEntity): Promise<RequestEntity>;
}

// Token for dependency injection
export const REQUEST_REPOSITORY = Symbol('RequestRepository');
