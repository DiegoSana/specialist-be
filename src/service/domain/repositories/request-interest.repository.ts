import { RequestInterestEntity } from '../entities/request-interest.entity';

export interface RequestInterestRepository {
  findByRequestId(requestId: string): Promise<RequestInterestEntity[]>;
  findByProfessionalId(professionalId: string): Promise<RequestInterestEntity[]>;
  findByRequestAndProfessional(requestId: string, professionalId: string): Promise<RequestInterestEntity | null>;
  create(data: {
    requestId: string;
    professionalId: string;
    message: string | null;
  }): Promise<RequestInterestEntity>;
  delete(requestId: string, professionalId: string): Promise<void>;
  deleteAllByRequestId(requestId: string): Promise<void>;
}

export const REQUEST_INTEREST_REPOSITORY = Symbol('RequestInterestRepository');



