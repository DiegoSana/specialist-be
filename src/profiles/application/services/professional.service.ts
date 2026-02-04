import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ProfessionalRepository,
  PROFESSIONAL_REPOSITORY,
} from '../../domain/repositories/professional.repository';
import {
  ProfessionalQueryRepository,
  PROFESSIONAL_QUERY_REPOSITORY,
} from '../../domain/queries/professional.query-repository';
import {
  ProfessionalEntity,
  ProfessionalAuthContext,
} from '../../domain/entities/professional.entity';
import {
  TradeRepository,
  TRADE_REPOSITORY,
} from '../../domain/repositories/trade.repository';
import { CreateProfessionalDto } from '../dto/create-professional.dto';
import { UpdateProfessionalDto } from '../dto/update-professional.dto';
import { SearchProfessionalsDto } from '../dto/search-professionals.dto';
import { ProfessionalStatus, RequestStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { UserService } from '../../../identity/application/services/user.service';
import { RequestService } from '../../../requests/application/services/request.service';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import { ProfileToggleService } from './profile-toggle.service';

@Injectable()
export class ProfessionalService {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(PROFESSIONAL_QUERY_REPOSITORY)
    private readonly professionalQueryRepository: ProfessionalQueryRepository,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: TradeRepository,
    @Inject(forwardRef(() => RequestService))
    private readonly requestService: RequestService,
    @Inject(forwardRef(() => ProfileToggleService))
    private readonly profileToggleService: ProfileToggleService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Auth Context Helper
  // ─────────────────────────────────────────────────────────────

  private buildAuthContext(user: UserEntity): ProfessionalAuthContext {
    return ProfessionalEntity.buildAuthContext(user.id, user.isAdminUser());
  }

  async search(
    searchDto: SearchProfessionalsDto,
  ): Promise<ProfessionalEntity[]> {
    const professionals = await this.professionalRepository.search({
      search: searchDto.search,
      tradeId: searchDto.tradeId,
      active: true, // Only show active professionals
    });

    // For public search, sanitize contact info and only return public gallery
    // Contact info (whatsapp, website, address) requires an active request
    return professionals.map((professional) =>
      this.sanitizeForPublic(professional) as ProfessionalEntity,
    );
  }

  async findById(id: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    // For public access, sanitize contact info
    return this.sanitizeForPublic(professional) as ProfessionalEntity;
  }

  /**
   * Internal (cross-context) load method.
   * Returns the full domain entity (not sanitized).
   */
  async getByIdOrFail(id: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }
    return professional;
  }

  /**
   * Admin use-case: update a professional status.
   */
  async updateStatus(
    professionalId: string,
    status: ProfessionalStatus,
    user: UserEntity,
  ): Promise<ProfessionalEntity> {
    const ctx = this.buildAuthContext(user);
    const professional = await this.getByIdOrFail(professionalId);

    if (!professional.canChangeStatusBy(ctx)) {
      throw new ForbiddenException('Only admins can change professional status');
    }

    const now = new Date();
    return this.professionalRepository.save(
      new ProfessionalEntity(
        professional.id,
        professional.userId,
        professional.serviceProviderId,
        professional.trades,
        professional.description,
        professional.experienceYears,
        status,
        professional.zone,
        professional.city,
        professional.address,
        professional.whatsapp,
        professional.website,
        professional.profileImage,
        professional.gallery,
        professional.active,
        professional.createdAt,
        now,
        professional.serviceProvider,
      ),
    );
  }

  /**
   * Sanitize professional data for public access
   * Removes contact info (whatsapp, website, address)
   * Contact info is only visible after creating a request
   */
  private sanitizeForPublic(
    professional: ProfessionalEntity,
  ): Partial<ProfessionalEntity> & { combinedGallery: string[]; user?: any } {
    const sanitized: any = {
      id: professional.id,
      userId: professional.userId,
      trades: professional.trades,
      description: professional.description,
      experienceYears: professional.experienceYears,
      status: professional.status,
      zone: professional.zone,
      city: professional.city,
      // address, whatsapp, website are intentionally omitted for public access
      averageRating: professional.averageRating,
      totalReviews: professional.totalReviews,
      profileImage: professional.profileImage,
      gallery: professional.gallery,
      active: professional.active,
      createdAt: professional.createdAt,
      updatedAt: professional.updatedAt,
      combinedGallery: professional.gallery || [],
    };

    // Include user data (name and profile picture are public)
    if ((professional as any).user) {
      sanitized.user = (professional as any).user;
    }

    return sanitized;
  }

  // Get professional with full combined gallery (for authenticated users with access)
  async findByIdWithFullGallery(
    id: string,
    requestingUserId?: string,
  ): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    // Get completed requests for this professional
    const completedRequests = await this.requestService.findByProviderId(
      professional.serviceProviderId,
    );
    const doneRequests = completedRequests.filter(
      (req) => req.status === RequestStatus.DONE,
    );

    // Collect photos from completed work
    // Only include photos from requests where the requesting user is a participant
    const completedWorkPhotos: string[] = [];
    doneRequests.forEach((request) => {
      // If no requesting user, only include public photos (none from requests)
      // If requesting user is the professional or was the client, include those photos
      const isParticipant =
        requestingUserId &&
        (professional.userId === requestingUserId ||
          request.clientId === requestingUserId);

      if (isParticipant && request.photos && request.photos.length > 0) {
        completedWorkPhotos.push(...request.photos);
      }
    });

    // Combine professional gallery with accessible completed work photos
    const combinedGallery = [
      ...(professional.gallery || []),
      ...completedWorkPhotos,
    ];
    (professional as any).combinedGallery = combinedGallery;

    return professional;
  }

  async findByUserId(userId: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    // For the professional viewing their own profile, include photos from their completed work
    const completedRequests = await this.requestService.findByProviderId(
      professional.serviceProviderId,
    );
    const doneRequests = completedRequests.filter(
      (req) => req.status === RequestStatus.DONE,
    );

    const completedWorkPhotos: string[] = [];
    doneRequests.forEach((request) => {
      if (request.photos && request.photos.length > 0) {
        completedWorkPhotos.push(...request.photos);
      }
    });

    const combinedGallery = [
      ...(professional.gallery || []),
      ...completedWorkPhotos,
    ];
    (professional as any).combinedGallery = combinedGallery;

    return professional;
  }

  /**
   * Find professional by their service provider ID.
   * Returns null if not found (unlike getByIdOrFail).
   */
  async findByServiceProviderId(serviceProviderId: string): Promise<ProfessionalEntity | null> {
    return this.professionalRepository.findByServiceProviderId(serviceProviderId);
  }

  async createProfile(
    userId: string,
    createDto: CreateProfessionalDto,
  ): Promise<{ professional: ProfessionalEntity; user: any }> {
    const user = await this.userService.findByIdOrFail(userId, true);

    if (!user.isActive()) {
      throw new BadRequestException('User account is not active');
    }

    // Check if professional profile already exists
    const existing = await this.professionalRepository.findByUserId(userId);
    if (existing) {
      throw new BadRequestException('Professional profile already exists');
    }

    // Verify all trades exist
    const trades: {
      id: string;
      name: string;
      category: string | null;
      description: string | null;
    }[] = [];
    for (const tradeId of createDto.tradeIds) {
      const trade = await this.tradeRepository.findById(tradeId);
      if (!trade) {
        throw new NotFoundException(`Trade with ID ${tradeId} not found`);
      }
      trades.push({
        id: trade.id,
        name: trade.name,
        category: trade.category,
        description: trade.description,
      });
    }

    const now = new Date();
    const professionalId = randomUUID();
    const serviceProviderId = randomUUID(); // ServiceProvider is created by repository

    const professional = await this.professionalRepository.save(
      new ProfessionalEntity(
        professionalId,
        userId,
        serviceProviderId,
        trades.map((t, index) => ({
          ...t,
          isPrimary: index === 0,
        })),
        createDto.description || null,
        createDto.experienceYears || null,
        ProfessionalStatus.PENDING_VERIFICATION,
        createDto.zone || null,
        createDto.city || 'Bariloche',
        createDto.address || null,
        createDto.whatsapp || null,
        createDto.website || null,
        createDto.profileImage || null,
        createDto.gallery || [],
        true,
        now,
        now,
      ),
    );

    // Reload user with updated profiles to return user info
    const updatedUser = await this.userService.findById(userId, true);
    return {
      professional,
      user: updatedUser
        ? {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            status: updatedUser.status,
            hasClientProfile: updatedUser.hasClientProfile,
            hasProfessionalProfile: updatedUser.hasProfessionalProfile,
            isAdmin: updatedUser.isAdminUser(),
          }
        : null,
    };
  }

  async updateProfile(
    user: UserEntity,
    professionalId: string,
    updateDto: UpdateProfessionalDto,
  ): Promise<ProfessionalEntity> {
    const ctx = this.buildAuthContext(user);
    const professional =
      await this.professionalRepository.findById(professionalId);

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    if (!professional.canBeEditedBy(ctx)) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Verify all trades exist if updating
    let nextTrades = professional.trades;
    if (updateDto.tradeIds && updateDto.tradeIds.length > 0) {
      const trades: {
        id: string;
        name: string;
        category: string | null;
        description: string | null;
      }[] = [];
      for (const tradeId of updateDto.tradeIds) {
        const trade = await this.tradeRepository.findById(tradeId);
        if (!trade) {
          throw new NotFoundException(`Trade with ID ${tradeId} not found`);
        }
        trades.push({
          id: trade.id,
          name: trade.name,
          category: trade.category,
          description: trade.description,
        });
      }
      nextTrades = trades.map((t, index) => ({
        ...t,
        isPrimary: index === 0,
      }));
    }

    const now = new Date();
    return this.professionalRepository.save(
      new ProfessionalEntity(
        professional.id,
        professional.userId,
        professional.serviceProviderId,
        nextTrades,
        updateDto.description !== undefined
          ? updateDto.description
          : professional.description,
        updateDto.experienceYears !== undefined
          ? updateDto.experienceYears
          : professional.experienceYears,
        professional.status,
        updateDto.zone !== undefined ? updateDto.zone : professional.zone,
        updateDto.city ? updateDto.city : professional.city,
        updateDto.address !== undefined
          ? updateDto.address
          : professional.address,
        updateDto.whatsapp !== undefined
          ? updateDto.whatsapp
          : professional.whatsapp,
        updateDto.website !== undefined
          ? updateDto.website
          : professional.website,
        updateDto.profileImage !== undefined
          ? updateDto.profileImage
          : professional.profileImage,
        updateDto.gallery !== undefined
          ? updateDto.gallery
          : professional.gallery,
        professional.active,
        professional.createdAt,
        now,
        professional.serviceProvider,
      ),
    );
  }

  async addGalleryItem(
    user: UserEntity,
    url: string,
  ): Promise<ProfessionalEntity> {
    const ctx = this.buildAuthContext(user);
    const professional = await this.professionalRepository.findByUserId(user.id);

    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    if (!professional.canManageGalleryBy(ctx)) {
      throw new ForbiddenException('You can only manage your own gallery');
    }

    const currentGallery = professional.gallery || [];
    if (currentGallery.includes(url)) {
      throw new BadRequestException('This image is already in the gallery');
    }

    const updatedGallery = [...currentGallery, url];

    return this.professionalRepository.save(
      new ProfessionalEntity(
        professional.id,
        professional.userId,
        professional.serviceProviderId,
        professional.trades,
        professional.description,
        professional.experienceYears,
        professional.status,
        professional.zone,
        professional.city,
        professional.address,
        professional.whatsapp,
        professional.website,
        professional.profileImage,
        updatedGallery,
        professional.active,
        professional.createdAt,
        new Date(),
        professional.serviceProvider,
      ),
    );
  }

  async removeGalleryItem(
    user: UserEntity,
    url: string,
  ): Promise<ProfessionalEntity> {
    const ctx = this.buildAuthContext(user);
    const professional = await this.professionalRepository.findByUserId(user.id);

    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    if (!professional.canManageGalleryBy(ctx)) {
      throw new ForbiddenException('You can only manage your own gallery');
    }

    const currentGallery = professional.gallery || [];
    const updatedGallery = currentGallery.filter((item) => item !== url);

    return this.professionalRepository.save(
      new ProfessionalEntity(
        professional.id,
        professional.userId,
        professional.serviceProviderId,
        professional.trades,
        professional.description,
        professional.experienceYears,
        professional.status,
        professional.zone,
        professional.city,
        professional.address,
        professional.whatsapp,
        professional.website,
        professional.profileImage,
        updatedGallery,
        professional.active,
        professional.createdAt,
        new Date(),
        professional.serviceProvider,
      ),
    );
  }

  /**
   * Update professional's rating statistics
   * Called by ReviewService after reviews are created/updated/deleted
   */
  async updateRating(
    professionalId: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void> {
    await this.professionalRepository.updateRating(
      professionalId,
      averageRating,
      totalReviews,
    );
  }

  /**
   * Activate professional profile (for users who want to switch from Company)
   * If user has an active Company profile, it will be deactivated.
   */
  async activateProfessionalProfile(userId: string): Promise<ProfessionalEntity> {
    return this.profileToggleService.activateProfessionalProfile(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics methods (for admin dashboard)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get professional statistics for admin dashboard
   * @returns Professional statistics
   */
  async getProfessionalStats() {
    return this.professionalQueryRepository.getProfessionalStats();
  }

  /**
   * Get all professionals for admin (paginated)
   */
  async getAllProfessionalsForAdmin(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const { professionals, total } = await this.professionalQueryRepository.findAllForAdmin({
      skip,
      take: limit,
    });

    return {
      data: professionals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get professional by ID for admin (with full details)
   */
  async getProfessionalByIdForAdmin(professionalId: string) {
    const professional = await this.professionalQueryRepository.findByIdForAdmin(professionalId);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }
    return professional;
  }
}
