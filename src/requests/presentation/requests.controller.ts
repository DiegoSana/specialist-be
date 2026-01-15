import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { RequestService } from '../application/services/request.service';
import { RequestInterestService } from '../application/services/request-interest.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CreateRequestDto } from '../application/dto/create-request.dto';
import { UpdateRequestDto } from '../application/dto/update-request.dto';
import {
  ExpressInterestDto,
  AssignProfessionalDto,
  AssignProviderDto,
} from '../application/dto/express-interest.dto';
import { RequestResponseDto } from './dto/request-response.dto';
import { InterestedProfessionalResponseDto } from './dto/interested-professional-response.dto';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(
    private readonly requestService: RequestService,
    private readonly requestInterestService: RequestInterestService,
    private readonly professionalService: ProfessionalService,
  ) {}

  // ==================== CRUD OPERATIONS ====================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new request' })
  @ApiResponse({ status: 201, description: 'Request created successfully', type: RequestResponseDto })
  async create(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateRequestDto,
  ): Promise<RequestResponseDto> {
    const entity = await this.requestService.create(user.id, createDto);
    return RequestResponseDto.fromEntity(entity);
  }

  @Get()
  @ApiOperation({ summary: 'Get my requests (as client or professional)' })
  @ApiResponse({ status: 200, description: 'List of requests', type: [RequestResponseDto] })
  @ApiQuery({ name: 'role', required: false, enum: ['client', 'professional'] })
  async findMyRequests(
    @CurrentUser() user: UserEntity,
    @Query('role') role?: 'client' | 'professional',
  ): Promise<RequestResponseDto[]> {
    // If role specified, use that. Otherwise, determine based on user profile
    let entities;
    if (role === 'client' || (!role && user.isClient())) {
      entities = await this.requestService.findByClientId(user.id);
    } else if (role === 'professional' || (!role && user.isProfessional())) {
      const professional = await this.professionalService.findByUserId(user.id);
      entities = await this.requestService.findByProfessionalId(professional.id);
    } else {
      entities = [];
    }

    return RequestResponseDto.fromEntities(entities);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available public requests for professionals' })
  @ApiResponse({ status: 200, description: 'List of available requests', type: [RequestResponseDto] })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'zone', required: false })
  async findAvailable(
    @CurrentUser() user: UserEntity,
    @Query('city') city?: string,
    @Query('zone') zone?: string,
  ): Promise<RequestResponseDto[]> {
    if (!user.hasProfessionalProfile) {
      throw new BadRequestException(
        'Only professionals can view available requests',
      );
    }

    const professional = await this.professionalService.findByUserId(user.id);
    const entities = await this.requestService.findAvailableForProfessional(
      professional.tradeIds,
      city,
      zone,
    );
    return RequestResponseDto.fromEntities(entities);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request by ID' })
  @ApiResponse({ status: 200, description: 'Request details', type: RequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestService.findByIdForUser(id, ctx);
    return RequestResponseDto.fromEntity(entity);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update request status' })
  @ApiResponse({ status: 200, description: 'Request updated successfully', type: RequestResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to update' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateRequestDto,
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestService.updateStatus(id, ctx, updateDto);
    return RequestResponseDto.fromEntity(entity);
  }

  // ==================== PHOTOS ====================

  @Post(':id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add photo to request' })
  @ApiResponse({ status: 201, description: 'Photo added successfully', type: RequestResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to add photos' })
  async addPhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestService.addRequestPhoto(id, ctx, body.url);
    return RequestResponseDto.fromEntity(entity);
  }

  @Delete(':id/photos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove photo from request' })
  @ApiResponse({ status: 200, description: 'Photo removed successfully', type: RequestResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to remove photos' })
  async removePhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestService.removeRequestPhoto(id, ctx, body.url);
    return RequestResponseDto.fromEntity(entity);
  }

  // ==================== INTEREST (for public requests) ====================

  @Post(':id/interest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Express interest in a public request (professional only)',
  })
  @ApiResponse({ status: 201, description: 'Interest expressed successfully', type: InterestedProfessionalResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to express interest' })
  async expressInterest(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ExpressInterestDto,
  ): Promise<InterestedProfessionalResponseDto> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestInterestService.expressInterest(id, ctx, dto);
    return InterestedProfessionalResponseDto.fromEntity(entity);
  }

  @Delete(':id/interest')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove interest from a public request' })
  @ApiResponse({ status: 204, description: 'Interest removed successfully' })
  async removeInterest(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    await this.requestInterestService.removeInterest(id, ctx);
  }

  @Get(':id/interest')
  @ApiOperation({ summary: 'Check if I have expressed interest' })
  @ApiResponse({ status: 200, description: 'Interest status' })
  async checkMyInterest(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<{ hasInterest: boolean }> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const hasInterest = await this.requestInterestService.hasExpressedInterest(
      id,
      ctx,
    );
    return { hasInterest };
  }

  @Get(':id/interests')
  @ApiOperation({ summary: 'Get all interested providers (client/admin only)' })
  @ApiResponse({ status: 200, description: 'List of interested providers', type: [InterestedProfessionalResponseDto] })
  @ApiResponse({ status: 403, description: 'Not authorized to view interests' })
  async getInterestedProviders(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<InterestedProfessionalResponseDto[]> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entities = await this.requestInterestService.getInterestedProviders(id, ctx);
    return InterestedProfessionalResponseDto.fromEntities(entities);
  }

  @Post(':id/assign-provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a provider to request (client/admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Provider assigned successfully',
    type: RequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to assign' })
  async assignProvider(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: AssignProviderDto,
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestInterestService.assignProvider(
      id,
      ctx,
      dto.serviceProviderId,
    );
    return RequestResponseDto.fromEntity(entity);
  }

  /**
   * @deprecated Use POST /assign-provider instead
   */
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Deprecated] Assign a professional - use /assign-provider instead' })
  @ApiResponse({
    status: 200,
    description: 'Professional assigned successfully',
    type: RequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to assign' })
  async assignProfessional(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: AssignProfessionalDto,
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestInterestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestInterestService.assignProfessional(
      id,
      ctx,
      dto.professionalId,
    );
    return RequestResponseDto.fromEntity(entity);
  }

  // ==================== CLIENT RATING (by professional) ====================

  @Post(':id/rate-client')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rate client (professional only, after work is done)',
  })
  @ApiResponse({ status: 200, description: 'Client rated successfully', type: RequestResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to rate client' })
  async rateClient(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { rating: number; comment?: string },
  ): Promise<RequestResponseDto> {
    const ctx = await this.requestService.buildAuthContext(
      user.id,
      user.isAdminUser(),
    );
    const entity = await this.requestService.rateClient(id, ctx, body.rating, body.comment);
    return RequestResponseDto.fromEntity(entity);
  }
}
