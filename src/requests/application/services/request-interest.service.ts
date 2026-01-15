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
import {
  RequestEntity,
  RequestAuthContext,
} from '../../domain/entities/request.entity';
import { ExpressInterestDto } from '../dto/express-interest.dto';
import { RequestStatus, ProviderType } from '@prisma/client';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { RequestInterestExpressedEvent } from '../../domain/events/request-interest-expressed.event';
import { RequestProfessionalAssignedEvent } from '../../domain/events/request-professional-assigned.event';
import { RequestStatusChangedEvent } from '../../domain/events/request-status-changed.event';
// Cross-context dependency - using Service instead of Repository (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';

/**
 * Extended context that includes both serviceProviderId (for Request auth) 
 * and professionalId (for RequestInterest operations)
 */
interface InterestAuthContext extends RequestAuthContext {
  professionalId?: string | null;
}

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
   * Build auth context from userId.
   * Returns both serviceProviderId (for Request auth) and professionalId (for RequestInterest).
   */
  async buildAuthContext(
    userId: string,
    isAdmin: boolean = false,
  ): Promise<InterestAuthContext> {
    let serviceProviderId: string | null = null;
    let professionalId: string | null = null;

    try {
      const professional = await this.professionalService.findByUserId(userId);
      if (professional) {
        professionalId = professional.id;
        serviceProviderId = professional.serviceProviderId;
      }
    } catch {
      // User doesn't have a professional profile
    }

    return { userId, serviceProviderId, professionalId, isAdmin };
  }

  /**
   * Specialist expresses interest in a public request.
   * Uses domain entity's canExpressInterestBy for permission validation.
   */
  async expressInterest(
    requestId: string,
    ctx: InterestAuthContext,
    dto: ExpressInterestDto,
  ): Promise<RequestInterestEntity> {
    // Must have a professional profile (only professionals can express interest)
    if (!ctx.professionalId) {
      throw new ForbiddenException('Only specialists can express interest');
    }

    // Get request
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Validate using domain logic
    if (!request.canExpressInterestBy(ctx)) {
      if (!request.isPublic) {
        throw new BadRequestException(
          'Can only express interest in public requests',
        );
      }
      if (!request.isPending()) {
        throw new BadRequestException('Request is no longer accepting interest');
      }
      throw new ForbiddenException('Cannot express interest in this request');
    }

    // Check if already expressed interest
    const existingInterest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        ctx.professionalId,
      );
    if (existingInterest) {
      throw new BadRequestException(
        'You have already expressed interest in this request',
      );
    }

    // Get professional info (includes user data via findByUserId)
    const professional = await this.professionalService.findByUserId(
      ctx.userId,
    ) as any;

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
      professionalId: ctx.professionalId,
      message: dto.message || null,
    });

    const providerName = professional.user
      ? `${professional.user.firstName} ${professional.user.lastName}`
      : 'Especialista';

    await this.eventBus.publish(
      new RequestInterestExpressedEvent({
        requestId,
        requestTitle: request.title,
        clientId: request.clientId,
        // New fields (preferred)
        serviceProviderId: professional.serviceProviderId,
        providerUserId: ctx.userId,
        providerType: ProviderType.PROFESSIONAL,
        providerName,
        // Backward compatibility
        professionalId: ctx.professionalId!,
        professionalName: providerName,
      }),
    );

    return savedInterest;
  }

  /**
   * Specialist removes their interest
   */
  async removeInterest(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<void> {
    if (!ctx.professionalId) {
      throw new ForbiddenException('Only specialists can remove interest');
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        ctx.professionalId,
      );
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    await this.requestInterestRepository.remove(requestId, ctx.professionalId);
  }

  /**
   * Get all interested specialists for a request.
   * Only client owner or admins can view.
   */
  async getInterestedProfessionals(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<RequestInterestEntity[]> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only client owner or admin can see interested professionals
    const isOwner = request.clientId === ctx.userId;
    if (!ctx.isAdmin && !isOwner) {
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
    ctx: InterestAuthContext,
  ): Promise<boolean> {
    if (!ctx.professionalId) {
      return false;
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProfessional(
        requestId,
        ctx.professionalId,
      );
    return interest !== null;
  }

  /**
   * Client assigns a specialist to the request.
   * Uses domain entity's canAssignProviderBy for permission validation.
   */
  async assignProfessional(
    requestId: string,
    ctx: InterestAuthContext,
    professionalId: string,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Validate using domain logic
    if (!request.canAssignProviderBy(ctx)) {
      if (request.clientId !== ctx.userId && !ctx.isAdmin) {
        throw new ForbiddenException(
          'Only the request owner can assign a specialist',
        );
      }
      if (!request.isPublic) {
        throw new BadRequestException(
          'Can only assign specialists to public requests',
        );
      }
      if (!request.isPending()) {
        throw new BadRequestException('Request is no longer pending');
      }
      throw new ForbiddenException('Cannot assign professional to this request');
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

    // Get the professional to get their serviceProviderId
    const professional = await this.professionalService.getByIdOrFail(professionalId);

    // Assign the professional (via their serviceProviderId) and change status to ACCEPTED
    // Also mark as no longer public
    const fromStatus = request.status;
    const updatedRequest = await this.requestRepository.save(
      request.withChanges({
        providerId: professional.serviceProviderId, // Use serviceProviderId
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
        // New fields (preferred)
        serviceProviderId: professional.serviceProviderId,
        providerUserId: professional.userId,
        providerType: ProviderType.PROFESSIONAL,
        // Backward compatibility
        professionalId,
      }),
    );

    if (updatedRequest.status !== fromStatus) {
      const providerName = prof?.user
        ? `${prof.user.firstName} ${prof.user.lastName}`
        : null;
      
      await this.eventBus.publish(
        new RequestStatusChangedEvent({
          requestId: updatedRequest.id,
          requestTitle: updatedRequest.title,
          clientId: updatedRequest.clientId,
          clientName,
          // New fields
          serviceProviderId: professional.serviceProviderId,
          providerUserId: professional.userId,
          providerType: ProviderType.PROFESSIONAL,
          providerName,
          // Backward compat
          professionalId: updatedRequest.providerId,
          professionalName: providerName,
          fromStatus,
          toStatus: updatedRequest.status,
          changedByUserId: ctx.userId,
        }),
      );
    }

    return updatedRequest;
  }
}
