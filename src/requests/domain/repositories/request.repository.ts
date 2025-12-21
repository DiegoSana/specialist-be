import { RequestEntity } from '../entities/request.entity';
import { RequestStatus } from '@prisma/client';

export interface RequestRepository {
  findById(id: string): Promise<RequestEntity | null>;
  findByClientId(clientId: string): Promise<RequestEntity[]>;
  findByProfessionalId(professionalId: string): Promise<RequestEntity[]>;
  findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]>;
  findAvailableForProfessional(
    tradeIds: string[],
    city?: string,
    zone?: string,
  ): Promise<RequestEntity[]>;
  create(request: {
    clientId: string;
    professionalId: string | null;
    tradeId: string | null;
    isPublic: boolean;
    description: string;
    address: string | null;
    availability: string | null;
    photos: string[];
    status: RequestStatus;
    quoteAmount: number | null;
    quoteNotes: string | null;
  }): Promise<RequestEntity>;
  update(id: string, data: Partial<RequestEntity>): Promise<RequestEntity>;
}

// Token for dependency injection
export const REQUEST_REPOSITORY = Symbol('RequestRepository');
