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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { RequestService } from '../application/services/request.service';
import { RequestInterestService } from '../application/services/request-interest.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CreateRequestDto } from '../application/dto/create-request.dto';
import { UpdateRequestDto } from '../application/dto/update-request.dto';
import { ExpressInterestDto, AssignProfessionalDto } from '../application/dto/express-interest.dto';

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
  @ApiResponse({ status: 201, description: 'Request created successfully' })
  async create(@CurrentUser() user: UserEntity, @Body() createDto: CreateRequestDto) {
    return this.requestService.create(user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my requests (as client or professional)' })
  @ApiResponse({ status: 200, description: 'List of requests' })
  @ApiQuery({ name: 'role', required: false, enum: ['client', 'professional'] })
  async findMyRequests(
    @CurrentUser() user: UserEntity,
    @Query('role') role?: 'client' | 'professional',
  ) {
    // If role specified, use that. Otherwise, determine based on user profile
    if (role === 'client' || (!role && user.isClient())) {
      return this.requestService.findByClientId(user.id);
    }
    
    if (role === 'professional' || (!role && user.isProfessional())) {
      const professional = await this.professionalService.findByUserId(user.id);
      return this.requestService.findByProfessionalId(professional.id);
    }
    
    return [];
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available public requests for professionals' })
  @ApiResponse({ status: 200, description: 'List of available requests' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'zone', required: false })
  async findAvailable(
    @CurrentUser() user: UserEntity,
    @Query('city') city?: string,
    @Query('zone') zone?: string,
  ) {
    if (!user.hasProfessionalProfile) {
      throw new BadRequestException('Only professionals can view available requests');
    }

    const professional = await this.professionalService.findByUserId(user.id);
    return this.requestService.findAvailableForProfessional(
      professional.tradeIds,
      city,
      zone,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request by ID' })
  @ApiResponse({ status: 200, description: 'Request details' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findById(@Param('id') id: string) {
    return this.requestService.findById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update request (status, quote, etc.)' })
  @ApiResponse({ status: 200, description: 'Request updated successfully' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateRequestDto,
  ) {
    // Determine if user is client or professional and route accordingly
    const request = await this.requestService.findById(id);
    
    if (request.clientId === user.id) {
      return this.requestService.updateStatusByClient(id, user.id, updateDto);
    }
    
    return this.requestService.updateStatus(id, user.id, updateDto);
  }

  // ==================== PHOTOS ====================

  @Post(':id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add photo to request' })
  @ApiResponse({ status: 201, description: 'Photo added successfully' })
  async addPhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ) {
    return this.requestService.addRequestPhoto(id, user.id, body.url);
  }

  @Delete(':id/photos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove photo from request' })
  @ApiResponse({ status: 200, description: 'Photo removed successfully' })
  async removePhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { url: string },
  ) {
    return this.requestService.removeRequestPhoto(id, user.id, body.url);
  }

  // ==================== INTEREST (for public requests) ====================

  @Post(':id/interest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Express interest in a public request (professional only)' })
  @ApiResponse({ status: 201, description: 'Interest expressed successfully' })
  async expressInterest(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ExpressInterestDto,
  ) {
    return this.requestInterestService.expressInterest(id, user.id, dto);
  }

  @Delete(':id/interest')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove interest from a public request' })
  @ApiResponse({ status: 204, description: 'Interest removed successfully' })
  async removeInterest(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    await this.requestInterestService.removeInterest(id, user.id);
  }

  @Get(':id/interest')
  @ApiOperation({ summary: 'Check if I have expressed interest' })
  @ApiResponse({ status: 200, description: 'Interest status' })
  async checkMyInterest(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const hasInterest = await this.requestInterestService.hasExpressedInterest(id, user.id);
    return { hasInterest };
  }

  @Get(':id/interests')
  @ApiOperation({ summary: 'Get all interested professionals (client only)' })
  @ApiResponse({ status: 200, description: 'List of interested professionals' })
  async getInterestedProfessionals(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.requestInterestService.getInterestedProfessionals(id, user.id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a professional to request (client only)' })
  @ApiResponse({ status: 200, description: 'Professional assigned successfully' })
  async assignProfessional(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: AssignProfessionalDto,
  ) {
    return this.requestInterestService.assignProfessional(id, user.id, dto.professionalId);
  }

  // ==================== ACCEPT QUOTE ====================

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept quote (client only)' })
  @ApiResponse({ status: 200, description: 'Quote accepted successfully' })
  async acceptQuote(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.requestService.acceptQuote(id, user.id);
  }
}

