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
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';

/**
 * Extended context that includes provider info for interest operations.
 * Works with both Professional and Company providers.
 */
interface InterestAuthContext extends RequestAuthContext {
  /** Provider type (PROFESSIONAL or COMPANY) */
  providerType?: ProviderType | null;
  /** Provider display name for notifications */
  providerName?: string | null;
  /** Trade IDs the provider has */
  providerTradeIds?: string[];
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
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  /**
   * Build auth context from userId.
   * Checks for both Professional and Company profiles.
   */
  async buildAuthContext(
    userId: string,
    isAdmin: boolean = false,
  ): Promise<InterestAuthContext> {
    let serviceProviderId: string | null = null;
    let providerType: ProviderType | null = null;
    let providerName: string | null = null;
    let providerTradeIds: string[] = [];

    // Try Professional first
    try {
      const professional = await this.professionalService.findByUserId(userId);
      if (professional) {
        serviceProviderId = professional.serviceProviderId;
        providerType = ProviderType.PROFESSIONAL;
        providerName = (professional as any).user
          ? `${(professional as any).user.firstName} ${(professional as any).user.lastName}`
          : 'Especialista';
        providerTradeIds = professional.tradeIds || [];
      }
    } catch {
      // User doesn't have a professional profile
    }

    // If no professional, try Company
    if (!serviceProviderId) {
      try {
        const company = await this.companyService.findByUserId(userId);
        if (company) {
          serviceProviderId = company.serviceProviderId;
          providerType = ProviderType.COMPANY;
          providerName = company.companyName;
          providerTradeIds = company.tradeIds || [];
        }
      } catch {
        // User doesn't have a company profile
      }
    }

    return {
      userId,
      serviceProviderId,
      providerType,
      providerName,
      providerTradeIds,
      isAdmin,
    };
  }

  /**
   * Provider (Professional or Company) expresses interest in a public request.
   * Uses domain entity's canExpressInterestBy for permission validation.
   */
  async expressInterest(
    requestId: string,
    ctx: InterestAuthContext,
    dto: ExpressInterestDto,
  ): Promise<RequestInterestEntity> {
    // Must have a provider profile
    if (!ctx.serviceProviderId) {
      throw new ForbiddenException(
        'Only service providers (professionals or companies) can express interest',
      );
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
      await this.requestInterestRepository.findByRequestAndProvider(
        requestId,
        ctx.serviceProviderId,
      );
    if (existingInterest) {
      throw new BadRequestException(
        'You have already expressed interest in this request',
      );
    }

    // Validate provider has matching trade (if request has tradeId)
    if (request.tradeId && ctx.providerTradeIds) {
      const hasTrade = ctx.providerTradeIds.includes(request.tradeId);
      if (!hasTrade) {
        throw new BadRequestException(
          'You do not have the required trade for this request',
        );
      }
    }

    const savedInterest = await this.requestInterestRepository.add({
      requestId,
      serviceProviderId: ctx.serviceProviderId,
      message: dto.message || null,
    });

    await this.eventBus.publish(
      new RequestInterestExpressedEvent({
        requestId,
        requestTitle: request.title,
        clientId: request.clientId,
        serviceProviderId: ctx.serviceProviderId,
        providerUserId: ctx.userId,
        providerType: ctx.providerType!,
        providerName: ctx.providerName || 'Proveedor',
        // Backward compatibility (deprecated)
        professionalId: ctx.serviceProviderId,
        professionalName: ctx.providerName || 'Especialista',
      }),
    );

    return savedInterest;
  }

  /**
   * Provider removes their interest
   */
  async removeInterest(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<void> {
    if (!ctx.serviceProviderId) {
      throw new ForbiddenException('Only providers can remove interest');
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProvider(
        requestId,
        ctx.serviceProviderId,
      );
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    await this.requestInterestRepository.remove(requestId, ctx.serviceProviderId);
  }

  /**
   * Get all interested providers for a request.
   * Only client owner or admins can view.
   */
  async getInterestedProviders(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<RequestInterestEntity[]> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only client owner or admin can see interested providers
    const isOwner = request.clientId === ctx.userId;
    if (!ctx.isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Only the request owner can view interested providers',
      );
    }

    return this.requestInterestRepository.findByRequestId(requestId);
  }

  /**
   * @deprecated Use getInterestedProviders instead
   */
  async getInterestedProfessionals(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<RequestInterestEntity[]> {
    return this.getInterestedProviders(requestId, ctx);
  }

  /**
   * Check if current user has expressed interest
   */
  async hasExpressedInterest(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<boolean> {
    if (!ctx.serviceProviderId) {
      return false;
    }

    const interest =
      await this.requestInterestRepository.findByRequestAndProvider(
        requestId,
        ctx.serviceProviderId,
      );
    return interest !== null;
  }

  /**
   * Get all requests where the current provider expressed interest.
   * Returns limited information if request was assigned to another provider.
   */
  async getMyInterestedRequests(
    serviceProviderId: string,
  ): Promise<RequestInterestEntity[]> {
    // Get all interests for this provider
    const interests =
      await this.requestInterestRepository.findByServiceProviderId(
        serviceProviderId,
      );

    // For each interest, fetch the request to determine if it was assigned to this provider
    const interestsWithRequests = await Promise.all(
      interests.map(async (interest) => {
        const request = await this.requestRepository.findById(
          interest.requestId,
        );
        return { interest, request };
      }),
    );

    // Return interests with attached request info
    return interestsWithRequests.map(({ interest, request }) => {
      if (request) {
        // Attach request info to interest entity
        (interest as any).request = request;
      }
      return interest;
    });
  }

  /**
   * Client assigns a provider to the request.
   * Uses domain entity's canAssignProviderBy for permission validation.
   */
  async assignProvider(
    requestId: string,
    ctx: InterestAuthContext,
    serviceProviderId: string,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Validate using domain logic
    if (!request.canAssignProviderBy(ctx)) {
      if (request.clientId !== ctx.userId && !ctx.isAdmin) {
        throw new ForbiddenException(
          'Only the request owner can assign a provider',
        );
      }
      if (!request.isPublic) {
        throw new BadRequestException(
          'Can only assign providers to public requests',
        );
      }
      if (!request.isPending()) {
        throw new BadRequestException('Request is no longer pending');
      }
      throw new ForbiddenException('Cannot assign provider to this request');
    }

    // Verify provider has expressed interest
    const interest =
      await this.requestInterestRepository.findByRequestAndProvider(
        requestId,
        serviceProviderId,
      );
    if (!interest) {
      throw new BadRequestException(
        'This provider has not expressed interest in this request',
      );
    }

    // Get provider info for notifications
    let providerUserId: string;
    let providerType: ProviderType;
    let providerName: string;

    // Try Professional first
    const professional = await this.professionalService.findByServiceProviderId(serviceProviderId);
    if (professional) {
      providerUserId = professional.userId;
      providerType = ProviderType.PROFESSIONAL;
      providerName = (professional as any).user
        ? `${(professional as any).user.firstName} ${(professional as any).user.lastName}`
        : 'Especialista';
    } else {
      // Try Company
      const company = await this.companyService.findByServiceProviderId(serviceProviderId);
      if (!company) {
        throw new NotFoundException('Provider not found');
      }
      providerUserId = company.userId;
      providerType = ProviderType.COMPANY;
      providerName = company.companyName;
    }

    // Assign the provider and change status to ACCEPTED
    // Also mark as no longer public
    // Note: We keep interests in DB so providers can see requests they were interested in
    const fromStatus = request.status;
    const updatedRequest = await this.requestRepository.save(
      request.withChanges({
        providerId: serviceProviderId,
        status: RequestStatus.ACCEPTED,
        isPublic: false,
      }),
    );

    // Keep interests in DB - providers can still see they expressed interest
    // even if request was assigned to someone else

    // Get client name for notifications
    const client = (updatedRequest as any).client;
    const clientName = client
      ? `${client.firstName} ${client.lastName}`
      : 'Cliente';

    await this.eventBus.publish(
      new RequestProfessionalAssignedEvent({
        requestId: updatedRequest.id,
        requestTitle: updatedRequest.title,
        clientId: updatedRequest.clientId,
        clientName,
        serviceProviderId,
        providerUserId,
        providerType,
        // Backward compatibility
        professionalId: serviceProviderId,
      }),
    );

    if (updatedRequest.status !== fromStatus) {
      await this.eventBus.publish(
        new RequestStatusChangedEvent({
          requestId: updatedRequest.id,
          requestTitle: updatedRequest.title,
          clientId: updatedRequest.clientId,
          clientName,
          serviceProviderId,
          providerUserId,
          providerType,
          providerName,
          // Backward compat
          professionalId: serviceProviderId,
          professionalName: providerName,
          fromStatus,
          toStatus: updatedRequest.status,
          changedByUserId: ctx.userId,
        }),
      );
    }

    return updatedRequest;
  }

  /**
   * Client unassigns the provider from a request.
   * Changes status back to PENDING and makes request public again.
   */
  async unassignProvider(
    requestId: string,
    ctx: InterestAuthContext,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Convert InterestAuthContext to RequestAuthContext for domain validation
    const requestCtx: RequestAuthContext = {
      userId: ctx.userId,
      serviceProviderId: null,
      isAdmin: ctx.isAdmin,
    };

    // Validate using domain logic
    if (!request.canUnassignProviderBy(requestCtx)) {
      if (request.clientId !== ctx.userId && !ctx.isAdmin) {
        throw new ForbiddenException(
          'Only the request owner can unassign a provider',
        );
      }
      if (!request.providerId) {
        throw new BadRequestException('Request has no provider assigned');
      }
      if (!request.isAccepted()) {
        throw new BadRequestException(
          'Can only unassign provider from accepted requests',
        );
      }
      throw new ForbiddenException('Cannot unassign provider from this request');
    }

    const fromStatus = request.status;
    const fromProviderId = request.providerId;

    // Unassign provider, change status to PENDING, and make public again
    const updatedRequest = await this.requestRepository.save(
      request.withChanges({
        providerId: null,
        status: RequestStatus.PENDING,
        isPublic: true,
      }),
    );

    // Get client name for notifications
    const client = (updatedRequest as any).client;
    const clientName = client
      ? `${client.firstName} ${client.lastName}`
      : 'Cliente';

    // Get provider info for notifications
    let providerUserId: string | null = null;
    let providerType: ProviderType | null = null;
    let providerName: string | null = null;

    if (fromProviderId) {
      // Try Professional first
      const professional = await this.professionalService.findByServiceProviderId(fromProviderId);
      if (professional) {
        providerUserId = professional.userId;
        providerType = ProviderType.PROFESSIONAL;
        providerName = (professional as any).user
          ? `${(professional as any).user.firstName} ${(professional as any).user.lastName}`
          : 'Especialista';
      } else {
        // Try Company
        const company = await this.companyService.findByServiceProviderId(fromProviderId);
        if (company) {
          providerUserId = company.userId;
          providerType = ProviderType.COMPANY;
          providerName = company.companyName;
        }
      }
    }

    // Publish status change event
    if (updatedRequest.status !== fromStatus) {
      await this.eventBus.publish(
        new RequestStatusChangedEvent({
          requestId: updatedRequest.id,
          requestTitle: updatedRequest.title,
          clientId: updatedRequest.clientId,
          clientName,
          serviceProviderId: null,
          providerUserId,
          providerType,
          providerName,
          // Backward compat
          professionalId: null,
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
