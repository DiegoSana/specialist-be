import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  RequestRepository,
  REQUEST_REPOSITORY,
} from '../../domain/repositories/request.repository';
import {
  RequestInterestRepository,
  REQUEST_INTEREST_REPOSITORY,
} from '../../domain/repositories/request-interest.repository';
import {
  RequestQueryRepository,
  REQUEST_QUERY_REPOSITORY,
} from '../../domain/queries/request.query-repository';
import {
  RequestEntity,
  RequestAuthContext,
} from '../../domain/entities/request.entity';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import { RequestStatus, ProviderType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { EVENT_BUS, EventBus } from '../../../shared/domain/events/event-bus';
import { RequestCreatedEvent } from '../../domain/events/request-created.event';
import { RequestStatusChangedEvent } from '../../domain/events/request-status-changed.event';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { CompanyService } from '../../../profiles/application/services/company.service';
import { UserService } from '../../../identity/application/services/user.service';
import { ProfileActivationService } from '../../../profiles/application/services/profile-activation.service';

@Injectable()
export class RequestService {
  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    @Inject(REQUEST_INTEREST_REPOSITORY)
    private readonly requestInterestRepository: RequestInterestRepository,
    @Inject(REQUEST_QUERY_REPOSITORY)
    private readonly requestQueryRepository: RequestQueryRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProfileActivationService))
    private readonly profileActivationService: ProfileActivationService,
  ) {}

  async create(
    clientId: string,
    createDto: CreateRequestDto,
  ): Promise<RequestEntity> {
    const user = await this.userService.findById(clientId, true);
    if (!user || !user.isClient()) {
      throw new BadRequestException('Only clients can create requests');
    }
    const activation = await this.profileActivationService.getActivationStatus(
      clientId,
    );
    if (!activation.hasActiveClientProfile) {
      throw new BadRequestException(
        'You must verify your email and phone to create a request',
      );
    }

    const isPublic = createDto.isPublic === true;

    // For direct requests, validate provider (professional or company) and get serviceProviderId
    let providerId: string | null = null;
    if (!isPublic) {
      if (!createDto.professionalId && !createDto.companyId) {
        throw new BadRequestException(
          'professionalId or companyId is required for direct requests',
        );
      }
      
      if (createDto.professionalId) {
        const professional = await this.professionalService.getByIdOrFail(
          createDto.professionalId,
        );
        if (!professional.isActive()) {
          throw new BadRequestException('Professional is not active');
        }
        providerId = professional.serviceProviderId;
      } else if (createDto.companyId) {
        const company = await this.companyService.getByIdOrFail(
          createDto.companyId,
        );
        if (!company.isActive()) {
          throw new BadRequestException('Company is not active');
        }
        providerId = company.serviceProviderId;
      }
    }

    // For public requests, validate trade
    if (isPublic && !createDto.tradeId) {
      throw new BadRequestException('tradeId is required for public requests');
    }

    const saved = await this.requestRepository.save(
      RequestEntity.createPending({
        id: randomUUID(),
        clientId,
        providerId,
        tradeId: createDto.tradeId || null,
        isPublic,
        title: createDto.title,
        description: createDto.description,
        address: createDto.address || null,
        availability: createDto.availability || null,
        photos: createDto.photos || [],
      }),
    );

    // Publish event even if Notifications decides not to notify on "created".
    await this.eventBus.publish(
      new RequestCreatedEvent({
        requestId: saved.id,
        clientId: saved.clientId,
        isPublic: saved.isPublic,
        professionalId: saved.providerId, // For backward compat in events
        tradeId: saved.tradeId,
      }),
    );

    return saved;
  }

  async findById(id: string): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  /**
   * Find a request by ID with access control validation.
   * Throws ForbiddenException if the user doesn't have permission.
   */
  async findByIdForUser(
    id: string,
    ctx: RequestAuthContext,
  ): Promise<RequestEntity> {
    const request = await this.findById(id);

    if (!request.canBeViewedBy(ctx)) {
      throw new ForbiddenException(
        'You do not have permission to view this request',
      );
    }

    return request;
  }

  /**
   * Return request for a provider who expressed interest but was not assigned.
   * Use when findByIdForUser returns 403 but the provider has interest (caller
   * should map result to a limited DTO: id, title, description, status, createdAt).
   * Throws NotFoundException if request missing, ForbiddenException if no interest.
   */
  async findByIdForInterestedProvider(
    id: string,
    serviceProviderId: string,
  ): Promise<RequestEntity> {
    const request = await this.findById(id);
    const interest =
      await this.requestInterestRepository.findByRequestAndProvider(
        id,
        serviceProviderId,
      );
    if (!interest) {
      throw new ForbiddenException(
        'You do not have permission to view this request',
      );
    }
    return request;
  }

  /**
   * Build auth context from userId using ProfileActivationService (single orchestration).
   * Resolves serviceProviderId for both professional and company; includes active flags.
   */
  async buildAuthContext(
    userId: string,
    isAdmin: boolean = false,
  ): Promise<RequestAuthContext> {
    const activation =
      await this.profileActivationService.getActivationStatus(userId);

    let serviceProviderId = activation.activeServiceProviderId;
    if (serviceProviderId === null) {
      try {
        const professional =
          await this.professionalService.findByUserId(userId);
        serviceProviderId = professional?.serviceProviderId ?? null;
      } catch {
        // no professional
      }
      if (serviceProviderId === null) {
        try {
          const company = await this.companyService.findByUserId(userId);
          serviceProviderId = company?.serviceProviderId ?? null;
        } catch {
          // no company
        }
      }
    }

    return {
      userId,
      serviceProviderId,
      isAdmin,
      hasActiveClientProfile: activation.hasActiveClientProfile,
      hasActiveProviderProfile: activation.hasActiveProviderProfile,
    };
  }

  async findByClientId(clientId: string): Promise<RequestEntity[]> {
    return this.requestRepository.findByClientId(clientId);
  }

  /**
   * Find requests by provider ID (ServiceProvider)
   */
  async findByProviderId(providerId: string): Promise<RequestEntity[]> {
    return this.requestRepository.findByProviderId(providerId);
  }


  async findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]> {
    return this.requestRepository.findPublicRequests(tradeIds);
  }

  async findAvailableForProfessional(
    tradeIds: string[],
    city?: string,
    zone?: string,
  ): Promise<RequestEntity[]> {
    return this.requestRepository.findAvailableForProfessional(
      tradeIds,
      city,
      zone,
    );
  }

  /**
   * Update request status with authorization check.
   * Uses domain entity's canChangeStatusBy for permission validation.
   */
  async updateStatus(
    requestId: string,
    ctx: RequestAuthContext,
    updateDto: UpdateRequestDto,
  ): Promise<RequestEntity> {
    const request = await this.findById(requestId);

    // Validate status change permission using domain logic
    if (updateDto.status && !request.canChangeStatusBy(ctx, updateDto.status)) {
      throw new ForbiddenException(
        'You do not have permission to change this request status',
      );
    }

    const fromStatus = request.status;
    const saved = await this.requestRepository.save(
      request.withChanges({
        status: updateDto.status,
      }),
    );

    if (updateDto.status && updateDto.status !== fromStatus) {
      // Get names for notification
      const client = (saved as any).client;
      const prof = (saved as any).professional;
      
      // Resolve provider info if assigned
      let providerUserId: string | null = null;
      let providerType: ProviderType | null = null;
      let providerName: string | null = null;

      if (saved.providerId) {
        // Try Professional first
        const professional = await this.professionalService.findByServiceProviderId(saved.providerId);
        if (professional) {
          providerUserId = professional.userId;
          providerType = ProviderType.PROFESSIONAL;
          providerName = prof?.user
            ? `${prof.user.firstName} ${prof.user.lastName}`
            : null;
        } else {
          // Try Company
          const company = await this.companyService.findByServiceProviderId(saved.providerId);
          if (company) {
            providerUserId = company.userId;
            providerType = ProviderType.COMPANY;
            providerName = company.companyName;
          }
        }
      }

      await this.eventBus.publish(
        new RequestStatusChangedEvent({
          requestId: saved.id,
          requestTitle: saved.title,
          clientId: saved.clientId,
          clientName: client
            ? `${client.firstName} ${client.lastName}`
            : 'Cliente',
          // New fields
          serviceProviderId: saved.providerId,
          providerUserId,
          providerType,
          providerName,
          // Backward compat
          professionalId: saved.providerId,
          professionalName: providerName,
          fromStatus,
          toStatus: saved.status,
          changedByUserId: ctx.userId,
        }),
      );
    }

    return saved;
  }


  /**
   * Add a photo to a request with authorization check.
   */
  async addRequestPhoto(
    requestId: string,
    ctx: RequestAuthContext,
    url: string,
  ): Promise<RequestEntity> {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new BadRequestException(`Invalid URL format: ${url}`);
    }

    const request = await this.findById(requestId);

    if (!request.canManagePhotosBy(ctx)) {
      throw new ForbiddenException(
        'You do not have permission to add photos to this request',
      );
    }

    const currentPhotos = request.photos || [];
    if (currentPhotos.includes(url)) {
      throw new BadRequestException('This photo is already in the request');
    }

    return this.requestRepository.save(
      request.withChanges({
        photos: [...currentPhotos, url],
      }),
    );
  }

  /**
   * Remove a photo from a request with authorization check.
   */
  async removeRequestPhoto(
    requestId: string,
    ctx: RequestAuthContext,
    url: string,
  ): Promise<RequestEntity> {
    const request = await this.findById(requestId);

    if (!request.canManagePhotosBy(ctx)) {
      throw new ForbiddenException(
        'You do not have permission to remove photos from this request',
      );
    }

    const currentPhotos = request.photos || [];
    return this.requestRepository.save(
      request.withChanges({
        photos: currentPhotos.filter((photo) => photo !== url),
      }),
    );
  }

  /**
   * Rate the client on a completed request.
   * Only the assigned professional can rate, and only after work is done.
   */
  async rateClient(
    requestId: string,
    ctx: RequestAuthContext,
    rating: number,
    comment?: string,
  ): Promise<RequestEntity> {
    const request = await this.findById(requestId);

    if (!request.canRateClientBy(ctx)) {
      if (!request.isDone()) {
        throw new BadRequestException(
          'Can only rate client after work is completed',
        );
      }
      if (request.clientRating !== null) {
        throw new BadRequestException(
          'Client has already been rated for this request',
        );
      }
      throw new ForbiddenException(
        'Only the assigned professional can rate the client',
      );
    }

    // Validate rating value
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.requestRepository.save(
      request.withChanges({
        clientRating: rating,
        clientRatingComment: comment || null,
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics methods (for admin dashboard)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get request statistics for admin dashboard
   * @returns Request statistics
   */
  async getRequestStats() {
    return this.requestQueryRepository.getRequestStats();
  }

  /**
   * Get all requests for admin (paginated, with optional status filter)
   */
  async getAllRequestsForAdmin(
    page: number = 1,
    limit: number = 10,
    status?: RequestStatus,
  ) {
    const skip = (page - 1) * limit;
    const { requests, total } = await this.requestQueryRepository.findAllForAdmin({
      skip,
      take: limit,
      status,
    });

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
