import { RequestInterestEntity } from '../entities/request-interest.entity';

/**
 * Association store (append/remove) entre Request y Professional.
 * No es un aggregate con "save", sino operaciones explícitas de intención.
 */
export interface RequestInterestRepository {
  findByRequestId(requestId: string): Promise<RequestInterestEntity[]>;
  findByProfessionalId(
    professionalId: string,
  ): Promise<RequestInterestEntity[]>;
  findByRequestAndProfessional(
    requestId: string,
    professionalId: string,
  ): Promise<RequestInterestEntity | null>;
  add(data: {
    requestId: string;
    professionalId: string;
    message: string | null;
  }): Promise<RequestInterestEntity>;
  remove(requestId: string, professionalId: string): Promise<void>;
  removeAllByRequestId(requestId: string): Promise<void>;
}

export const REQUEST_INTEREST_REPOSITORY = Symbol('RequestInterestRepository');
