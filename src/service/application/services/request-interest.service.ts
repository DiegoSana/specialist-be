import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { RequestInterestRepository, REQUEST_INTEREST_REPOSITORY } from '../../domain/repositories/request-interest.repository';
import { RequestRepository, REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from '../../domain/repositories/professional.repository';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { RequestEntity } from '../../domain/entities/request.entity';
import { ExpressInterestDto } from '../dto/express-interest.dto';
import { RequestStatus } from '@prisma/client';

@Injectable()
export class RequestInterestService {
  constructor(
    @Inject(REQUEST_INTEREST_REPOSITORY)
    private readonly requestInterestRepository: RequestInterestRepository,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
  ) {}

  /**
   * Specialist expresses interest in a public request
   */
  async expressInterest(
    requestId: string,
    userId: string,
    dto: ExpressInterestDto,
  ): Promise<RequestInterestEntity> {
    // Get professional profile
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new ForbiddenException('Only specialists can express interest');
    }

    // Get request
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Validate request is public and pending
    if (!request.isPublic) {
      throw new BadRequestException('Can only express interest in public requests');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer accepting interest');
    }

    // Check if already expressed interest
    const existingInterest = await this.requestInterestRepository.findByRequestAndProfessional(
      requestId,
      professional.id,
    );
    if (existingInterest) {
      throw new BadRequestException('You have already expressed interest in this request');
    }

    // Validate professional has matching trade
    if (request.tradeId) {
      const hasTrade = professional.tradeIds.includes(request.tradeId);
      if (!hasTrade) {
        throw new BadRequestException('You do not have the required trade for this request');
      }
    }

    return this.requestInterestRepository.create({
      requestId,
      professionalId: professional.id,
      message: dto.message || null,
    });
  }

  /**
   * Specialist removes their interest
   */
  async removeInterest(requestId: string, userId: string): Promise<void> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new ForbiddenException('Only specialists can remove interest');
    }

    const interest = await this.requestInterestRepository.findByRequestAndProfessional(
      requestId,
      professional.id,
    );
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    await this.requestInterestRepository.delete(requestId, professional.id);
  }

  /**
   * Get all interested specialists for a request (for client)
   */
  async getInterestedProfessionals(requestId: string, userId: string): Promise<RequestInterestEntity[]> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only the client can see interested professionals
    if (request.clientId !== userId) {
      throw new ForbiddenException('Only the request owner can view interested specialists');
    }

    return this.requestInterestRepository.findByRequestId(requestId);
  }

  /**
   * Check if current user has expressed interest
   */
  async hasExpressedInterest(requestId: string, userId: string): Promise<boolean> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      return false;
    }

    const interest = await this.requestInterestRepository.findByRequestAndProfessional(
      requestId,
      professional.id,
    );
    return interest !== null;
  }

  /**
   * Client assigns a specialist to the request
   */
  async assignProfessional(
    requestId: string,
    userId: string,
    professionalId: string,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only the client can assign
    if (request.clientId !== userId) {
      throw new ForbiddenException('Only the request owner can assign a specialist');
    }

    // Must be a public request
    if (!request.isPublic) {
      throw new BadRequestException('Can only assign specialists to public requests');
    }

    // Must be pending
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    // Verify professional exists and has expressed interest
    const interest = await this.requestInterestRepository.findByRequestAndProfessional(
      requestId,
      professionalId,
    );
    if (!interest) {
      throw new BadRequestException('This specialist has not expressed interest in this request');
    }

    // Assign the professional and change status to ACCEPTED
    // Also mark as no longer public
    const updatedRequest = await this.requestRepository.update(requestId, {
      professionalId,
      status: RequestStatus.ACCEPTED,
      isPublic: false,
    } as any);

    // Clean up all interests for this request
    await this.requestInterestRepository.deleteAllByRequestId(requestId);

    return updatedRequest;
  }
}



