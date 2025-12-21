import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { RequestRepository, REQUEST_REPOSITORY } from '../../domain/repositories/request.repository';
import { RequestEntity } from '../../domain/entities/request.entity';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto } from '../dto/update-request.dto';
import { RequestStatus } from '@prisma/client';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { ProfessionalService } from '../../../profiles/application/services/professional.service';
import { UserService } from '../../../identity/application/services/user.service';

@Injectable()
export class RequestService {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requestRepository: RequestRepository,
    @Inject(forwardRef(() => ProfessionalService)) private readonly professionalService: ProfessionalService,
    private readonly userService: UserService,
  ) {}

  async create(clientId: string, createDto: CreateRequestDto): Promise<RequestEntity> {
    const user = await this.userService.findById(clientId, true);
    if (!user || !user.isClient()) {
      throw new BadRequestException('Only clients can create requests');
    }

    const isPublic = createDto.isPublic === true;

    // For direct requests, validate professional
    if (!isPublic) {
      if (!createDto.professionalId) {
        throw new BadRequestException('professionalId is required for direct requests');
      }
      
      const professional = await this.professionalService.findById(createDto.professionalId);
      if (!professional) {
        throw new NotFoundException('Professional not found');
      }

      if (!professional.isActive()) {
        throw new BadRequestException('Professional is not active');
      }
    }

    // For public requests, validate trade
    if (isPublic && !createDto.tradeId) {
      throw new BadRequestException('tradeId is required for public requests');
    }

    return this.requestRepository.create({
      clientId,
      professionalId: isPublic ? null : createDto.professionalId!,
      tradeId: createDto.tradeId || null,
      isPublic,
      description: createDto.description,
      address: createDto.address || null,
      availability: createDto.availability || null,
      photos: createDto.photos || [],
      status: RequestStatus.PENDING,
      quoteAmount: null,
      quoteNotes: null,
    });
  }

  async findById(id: string): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async findByClientId(clientId: string): Promise<RequestEntity[]> {
    return this.requestRepository.findByClientId(clientId);
  }

  async findByProfessionalId(professionalId: string): Promise<RequestEntity[]> {
    return this.requestRepository.findByProfessionalId(professionalId);
  }

  async findPublicRequests(tradeIds?: string[]): Promise<RequestEntity[]> {
    return this.requestRepository.findPublicRequests(tradeIds);
  }

  async findAvailableForProfessional(tradeIds: string[], city?: string, zone?: string): Promise<RequestEntity[]> {
    return this.requestRepository.findAvailableForProfessional(tradeIds, city, zone);
  }

  async updateStatus(
    requestId: string,
    userId: string,
    updateDto: UpdateRequestDto,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const professional = await this.professionalService.findByUserId(userId);
    if (!professional || professional.id !== request.professionalId) {
      throw new ForbiddenException('Only the assigned professional can update this request');
    }

    return this.requestRepository.update(requestId, {
      status: updateDto.status,
      quoteAmount: updateDto.quoteAmount,
      quoteNotes: updateDto.quoteNotes,
    });
  }

  async acceptQuote(requestId: string, userId: string): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.clientId !== userId) {
      throw new ForbiddenException('Only the client can accept the quote');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be accepted');
    }

    if (!request.quoteAmount) {
      throw new BadRequestException('Request must have a quote before it can be accepted');
    }

    return this.requestRepository.update(requestId, {
      status: RequestStatus.ACCEPTED,
    });
  }

  async updateStatusByClient(
    requestId: string,
    userId: string,
    updateDto: UpdateRequestDto,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.clientId !== userId) {
      throw new ForbiddenException('Only the client can update this request');
    }

    // Client can only cancel or accept
    if (updateDto.status && updateDto.status !== RequestStatus.CANCELLED && updateDto.status !== RequestStatus.ACCEPTED) {
      throw new BadRequestException('Clients can only cancel or accept requests');
    }

    // If accepting, validate quote exists
    if (updateDto.status === RequestStatus.ACCEPTED) {
      if (!request.quoteAmount) {
        throw new BadRequestException('Request must have a quote before it can be accepted');
      }
      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be accepted');
      }
    }

    return this.requestRepository.update(requestId, {
      status: updateDto.status,
    });
  }

  async addRequestPhoto(requestId: string, userId: string, url: string): Promise<RequestEntity> {
    // Validate URL format before proceeding
    try {
      new URL(url);
    } catch (error) {
      throw new BadRequestException(`Invalid URL format: ${url}`);
    }

    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Check if user is either the client or the assigned professional
    const isClient = request.clientId === userId;
    let isProfessional = false;
    
    if (request.professionalId) {
      const professional = await this.professionalService.findByUserId(userId);
      isProfessional = professional !== null && professional.id === request.professionalId;
    }

    if (!isClient && !isProfessional) {
      throw new ForbiddenException('Only the client or assigned professional can add photos to this request');
    }

    // Don't allow adding photos to cancelled requests
    if (request.status === RequestStatus.CANCELLED) {
      throw new BadRequestException('Photos cannot be added to cancelled requests');
    }

    const currentPhotos = request.photos || [];
    if (currentPhotos.includes(url)) {
      throw new BadRequestException('This photo is already in the request');
    }

    const updatedPhotos = [...currentPhotos, url];

    return this.requestRepository.update(requestId, {
      photos: updatedPhotos,
    });
  }

  async removeRequestPhoto(requestId: string, userId: string, url: string): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Check if user is either the client or the assigned professional
    const isClient = request.clientId === userId;
    let isProfessional = false;
    
    if (request.professionalId) {
      const professional = await this.professionalService.findByUserId(userId);
      isProfessional = professional !== null && professional.id === request.professionalId;
    }

    if (!isClient && !isProfessional) {
      throw new ForbiddenException('Only the client or assigned professional can remove photos from this request');
    }

    const currentPhotos = request.photos || [];
    const updatedPhotos = currentPhotos.filter((photo) => photo !== url);

    return this.requestRepository.update(requestId, {
      photos: updatedPhotos,
    });
  }

  async rateClient(
    requestId: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<RequestEntity> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Only the assigned professional can rate the client
    const professional = await this.professionalService.findByUserId(userId);
    if (!professional || professional.id !== request.professionalId) {
      throw new ForbiddenException('Only the assigned professional can rate the client');
    }

    // Can only rate after work is done
    if (request.status !== RequestStatus.DONE) {
      throw new BadRequestException('Can only rate client after work is completed');
    }

    // Check if already rated
    if (request.clientRating !== null) {
      throw new BadRequestException('Client has already been rated for this request');
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.requestRepository.update(requestId, {
      clientRating: rating,
      clientRatingComment: comment || null,
    });
  }
}
