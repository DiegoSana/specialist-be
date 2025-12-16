import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { ProfessionalRepository, PROFESSIONAL_REPOSITORY } from '../../domain/repositories/professional.repository';
import { ProfessionalEntity } from '../../domain/entities/professional.entity';
import { UserRepository, USER_REPOSITORY } from '../../../user-management/domain/repositories/user.repository';
import { TradeRepository, TRADE_REPOSITORY } from '../../domain/repositories/trade.repository';
import { RequestRepository, REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { CreateProfessionalDto } from '../dto/create-professional.dto';
import { UpdateProfessionalDto } from '../dto/update-professional.dto';
import { SearchProfessionalsDto } from '../dto/search-professionals.dto';
import { ProfessionalStatus, RequestStatus } from '@prisma/client';

@Injectable()
export class ProfessionalService {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY) private readonly professionalRepository: ProfessionalRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TRADE_REPOSITORY) private readonly tradeRepository: TradeRepository,
    @Inject(REQUEST_REPOSITORY) private readonly requestRepository: RequestRepository,
  ) {}

  async search(searchDto: SearchProfessionalsDto): Promise<Partial<ProfessionalEntity>[]> {
    const professionals = await this.professionalRepository.search({
      search: searchDto.search,
      tradeId: searchDto.tradeId,
      active: true, // Only show active professionals
    });

    // For public search, sanitize contact info and only return public gallery
    // Contact info (whatsapp, website, address) requires an active request
    return professionals.map((professional) => this.sanitizeForPublic(professional));
  }

  async findById(id: string): Promise<Partial<ProfessionalEntity>> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }
    
    // For public access, sanitize contact info
    return this.sanitizeForPublic(professional);
  }

  /**
   * Sanitize professional data for public access
   * Removes contact info (whatsapp, website, address) 
   * Contact info is only visible after creating a request
   */
  private sanitizeForPublic(professional: ProfessionalEntity): Partial<ProfessionalEntity> & { combinedGallery: string[] } {
    return {
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
  }

  // Get professional with full combined gallery (for authenticated users with access)
  async findByIdWithFullGallery(id: string, requestingUserId?: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    // Get completed requests for this professional
    const completedRequests = await this.requestRepository.findByProfessionalId(professional.id);
    const doneRequests = completedRequests.filter((req) => req.status === RequestStatus.DONE);

    // Collect photos from completed work
    // Only include photos from requests where the requesting user is a participant
    const completedWorkPhotos: string[] = [];
    doneRequests.forEach((request) => {
      // If no requesting user, only include public photos (none from requests)
      // If requesting user is the professional or was the client, include those photos
      const isParticipant = requestingUserId && 
        (professional.userId === requestingUserId || request.clientId === requestingUserId);
      
      if (isParticipant && request.photos && request.photos.length > 0) {
        completedWorkPhotos.push(...request.photos);
      }
    });

    // Combine professional gallery with accessible completed work photos
    const combinedGallery = [...(professional.gallery || []), ...completedWorkPhotos];
    (professional as any).combinedGallery = combinedGallery;

    return professional;
  }

  async findByUserId(userId: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    // For the professional viewing their own profile, include photos from their completed work
    const completedRequests = await this.requestRepository.findByProfessionalId(professional.id);
    const doneRequests = completedRequests.filter((req) => req.status === RequestStatus.DONE);

    const completedWorkPhotos: string[] = [];
    doneRequests.forEach((request) => {
      if (request.photos && request.photos.length > 0) {
        completedWorkPhotos.push(...request.photos);
      }
    });

    const combinedGallery = [...(professional.gallery || []), ...completedWorkPhotos];
    (professional as any).combinedGallery = combinedGallery;

    return professional;
  }

  async createProfile(userId: string, createDto: CreateProfessionalDto): Promise<{ professional: ProfessionalEntity; user: any }> {
    const user = await this.userRepository.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive()) {
      throw new BadRequestException('User account is not active');
    }

    // Check if professional profile already exists
    const existing = await this.professionalRepository.findByUserId(userId);
    if (existing) {
      throw new BadRequestException('Professional profile already exists');
    }

    // Verify all trades exist
    for (const tradeId of createDto.tradeIds) {
      const trade = await this.tradeRepository.findById(tradeId);
      if (!trade) {
        throw new NotFoundException(`Trade with ID ${tradeId} not found`);
      }
    }

    const professional = await this.professionalRepository.create({
      userId,
      tradeIds: createDto.tradeIds,
      description: createDto.description || null,
      experienceYears: createDto.experienceYears || null,
      status: ProfessionalStatus.PENDING_VERIFICATION,
      zone: createDto.zone || null,
      city: createDto.city || 'Bariloche',
      address: createDto.address || null,
      whatsapp: createDto.whatsapp || null,
      website: createDto.website || null,
      profileImage: createDto.profileImage || null,
      gallery: createDto.gallery || [],
      active: true,
    });

    // Reload user with updated profiles to return user info
    const updatedUser = await this.userRepository.findById(userId, true);
    
    return {
      professional,
      user: updatedUser ? {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        status: updatedUser.status,
        hasClientProfile: updatedUser.hasClientProfile,
        hasProfessionalProfile: updatedUser.hasProfessionalProfile,
        isAdmin: updatedUser.isAdminUser(),
      } : null,
    };
  }

  async updateProfile(
    userId: string,
    professionalId: string,
    updateDto: UpdateProfessionalDto,
  ): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findById(professionalId);
    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    if (professional.userId !== userId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Verify all trades exist if updating
    if (updateDto.tradeIds && updateDto.tradeIds.length > 0) {
      for (const tradeId of updateDto.tradeIds) {
        const trade = await this.tradeRepository.findById(tradeId);
        if (!trade) {
          throw new NotFoundException(`Trade with ID ${tradeId} not found`);
        }
      }
    }

    // Convert UpdateProfessionalDto to update data
    const updateData: Partial<ProfessionalEntity> & { tradeIds?: string[] } = {
      ...(updateDto.description !== undefined && { description: updateDto.description }),
      ...(updateDto.experienceYears !== undefined && { experienceYears: updateDto.experienceYears }),
      ...(updateDto.zone !== undefined && { zone: updateDto.zone }),
      ...(updateDto.city && { city: updateDto.city }),
      ...(updateDto.address !== undefined && { address: updateDto.address }),
      ...(updateDto.whatsapp !== undefined && { whatsapp: updateDto.whatsapp }),
      ...(updateDto.website !== undefined && { website: updateDto.website }),
      ...(updateDto.profileImage !== undefined && { profileImage: updateDto.profileImage }),
      ...(updateDto.gallery !== undefined && { gallery: updateDto.gallery }),
      ...(updateDto.tradeIds && { tradeIds: updateDto.tradeIds }),
    };

    return this.professionalRepository.update(professionalId, updateData);
  }

  async addGalleryItem(userId: string, url: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    const currentGallery = professional.gallery || [];
    if (currentGallery.includes(url)) {
      throw new BadRequestException('This image is already in the gallery');
    }

    const updatedGallery = [...currentGallery, url];

    return this.professionalRepository.update(professional.id, {
      gallery: updatedGallery,
    });
  }

  async removeGalleryItem(userId: string, url: string): Promise<ProfessionalEntity> {
    const professional = await this.professionalRepository.findByUserId(userId);
    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    const currentGallery = professional.gallery || [];
    const updatedGallery = currentGallery.filter((item) => item !== url);

    return this.professionalRepository.update(professional.id, {
      gallery: updatedGallery,
    });
  }
}

