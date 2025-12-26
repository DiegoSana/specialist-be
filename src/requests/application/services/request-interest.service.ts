import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  RequestInterestRepository,
  REQUEST_INTEREST_REPOSITORY,
} from '../../domain/repositories/request-interest.repository';
import {
  RequestRepository,
  REQUEST_REPOSITORY,
} from '../../domain/repositories/request.repository';
import { RequestInterestEntity } from '../../domain/entities/request-interest.entity';
import { RequestEntity } from '../../domain/entities/request.entity';
import { ExpressInterestDto } from '../dto/express-interest.dto';
import { RequestStatus } from '@prisma/client';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { RequestInterestExpressedEvent } from '../../domain/events/request-interest-expressed.event';
import { RequestProfessionalAssignedEvent } from '../../domain/events/request-professional-assigned.event';
import { RequestStatusChangedEvent } from '../../domain/events/request-status-changed.event';
// Cross-context dependency - using Service instead of Repository (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';

@Injectable()
export class RequestInterestService {
  constructor(
    @Inject(REQUEST_INTEREST_REPOSITORY)
    private readonly requestInterestRepository: RequestInterestRepository,
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
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
    let professional: any;
    try {
      professional = await this.professionalService.findByUserId(userId);
    } catch {
      throw new ForbiddenException('Only specialists can express interest');
    }
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
      throw new BadRequestException(
        'Can only express interest in public requests',
      );
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer accepting interest');
    }

    // Check if already expressed interest
    const existingInterest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        professional.id,
      );
    if (existingInterest) {
      throw new BadRequestException(
        'You have already expressed interest in this request',
      );
    }

    // Validate professional has matching trade
    if (request.tradeId) {
      const hasTrade = professional.tradeIds.includes(request.tradeId);
      if (!hasTrade) {
        throw new BadRequestException(
          'You do not have the required trade for this request',
        );
      }
    }

    const savedInterest = await this.requestInterestRepository.add({
      requestId,
      professionalId: professional.id,
      message: dto.message || null,
    });

    await this.eventBus.publish(
      new RequestInterestExpressedEvent({
        requestId,
        requestTitle: request.title,
        clientId: request.clientId,
        professionalId: professional.id,
        professionalName: professional.user
          ? `${professional.user.firstName} ${professional.user.lastName}`
          : 'Especialista',
      }),
    );

    return savedInterest;
  }

  /**
   * Specialist removes their interest
   */
  async removeInterest(requestId: string, userId: string): Promise<void> {
    let professional: any;
    try {
      professional = await this.professionalService.findByUserId(userId);
    } catch {
      throw new ForbiddenException('Only specialists can remove interest');
    }
    if (!professional) {
      throw new ForbiddenException('Only specialists can remove interest');
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        professional.id,
      );
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    await this.requestInterestRepository.remove(requestId, professional.id);
  }

  /**
   * Get all interested specialists for a request (for client)
   */
  async getInterestedProfessionals(
    requestId: string,
    userId: string,
  ): Promise<RequestInterestEntity[]> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only the client can see interested professionals
    if (request.clientId !== userId) {
      throw new ForbiddenException(
        'Only the request owner can view interested specialists',
      );
    }

    return this.requestInterestRepository.findByRequestId(requestId);
  }

  /**
   * Check if current user has expressed interest
   */
  async hasExpressedInterest(
    requestId: string,
    userId: string,
  ): Promise<boolean> {
    let professional: any;
    try {
      professional = await this.professionalService.findByUserId(userId);
    } catch {
      return false;
    }
    if (!professional) {
      return false;
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProfessional(
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
      throw new ForbiddenException(
        'Only the request owner can assign a specialist',
      );
    }

    // Must be a public request
    if (!request.isPublic) {
      throw new BadRequestException(
        'Can only assign specialists to public requests',
      );
    }

    // Must be pending
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    // Verify professional exists and has expressed interest
    const interest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        professionalId,
      );
    if (!interest) {
      throw new BadRequestException(
        'This specialist has not expressed interest in this request',
      );
    }

    // Assign the professional and change status to ACCEPTED
    // Also mark as no longer public
    const fromStatus = request.status;
    const updatedRequest = await this.requestRepository.save(
      request.withChanges({
        professionalId,
        status: RequestStatus.ACCEPTED,
        isPublic: false,
      }),
    );

    // Clean up all interests for this request
    await this.requestInterestRepository.removeAllByRequestId(requestId);

    // Get names for notifications
    const client = (updatedRequest as any).client;
    const prof = (updatedRequest as any).professional;
    const clientName = client
      ? `${client.firstName} ${client.lastName}`
      : 'Cliente';

    await this.eventBus.publish(
      new RequestProfessionalAssignedEvent({
        requestId: updatedRequest.id,
        requestTitle: updatedRequest.title,
        clientId: updatedRequest.clientId,
        clientName,
        professionalId,
      }),
    );

    if (updatedRequest.status !== fromStatus) {
      await this.eventBus.publish(
        new RequestStatusChangedEvent({
          requestId: updatedRequest.id,
          requestTitle: updatedRequest.title,
          clientId: updatedRequest.clientId,
          clientName,
          professionalId: updatedRequest.professionalId,
          professionalName: prof?.user
            ? `${prof.user.firstName} ${prof.user.lastName}`
            : null,
          fromStatus,
          toStatus: updatedRequest.status,
          changedByUserId: userId,
        }),
      );
    }

    return updatedRequest;
  }
}
