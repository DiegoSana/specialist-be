import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../user-management/domain/entities/user.entity';
import { TradeService } from '../application/services/trade.service';
import { ProfessionalService } from '../application/services/professional.service';
import { RequestService } from '../application/services/request.service';
import { RequestInterestService } from '../application/services/request-interest.service';
import { CreateTradeDto } from '../application/dto/create-trade.dto';
import { UpdateTradeDto } from '../application/dto/update-trade.dto';
import { CreateProfessionalDto } from '../application/dto/create-professional.dto';
import { UpdateProfessionalDto } from '../application/dto/update-professional.dto';
import { SearchProfessionalsDto } from '../application/dto/search-professionals.dto';
import { CreateRequestDto } from '../application/dto/create-request.dto';
import { UpdateRequestDto } from '../application/dto/update-request.dto';
import { AddGalleryItemDto } from '../application/dto/add-gallery-item.dto';
import { AddRequestPhotoDto } from '../application/dto/add-completed-work-photo.dto';
import { ExpressInterestDto, AssignProfessionalDto } from '../application/dto/express-interest.dto';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Service')
@Controller('service')
export class ServiceController {
  constructor(
    private readonly tradeService: TradeService,
    private readonly professionalService: ProfessionalService,
    private readonly requestService: RequestService,
    private readonly requestInterestService: RequestInterestService,
  ) {}

  // Trades endpoints
  @Public()
  @Get('trades')
  @ApiOperation({ summary: 'Get all trades' })
  @ApiResponse({ status: 200, description: 'List of trades' })
  async getTrades() {
    return this.tradeService.findAll();
  }

  @Public()
  @Get('trades/with-professionals')
  @ApiOperation({ summary: 'Get trades that have active professionals' })
  @ApiResponse({ status: 200, description: 'List of trades with active professionals' })
  async getTradesWithProfessionals() {
    return this.tradeService.findWithActiveProfessionals();
  }

  @Public()
  @Get('trades/:id')
  @ApiOperation({ summary: 'Get trade by ID' })
  @ApiResponse({ status: 200, description: 'Trade details' })
  async getTrade(@Param('id') id: string) {
    return this.tradeService.findById(id);
  }

  // Professionals endpoints
  @Public()
  @Get('professionals')
  @ApiOperation({ summary: 'Search professionals' })
  @ApiResponse({ status: 200, description: 'List of professionals' })
  async searchProfessionals(@Query() searchDto: SearchProfessionalsDto) {
    return this.professionalService.search(searchDto);
  }

  @Public()
  @Get('professionals/:id')
  @ApiOperation({ summary: 'Get professional by ID' })
  @ApiResponse({ status: 200, description: 'Professional details' })
  async getProfessional(@Param('id') id: string) {
    return this.professionalService.findById(id);
  }

  @Get('professionals/me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current professional profile' })
  @ApiResponse({ status: 200, description: 'Professional profile' })
  async getMyProfile(@CurrentUser() user: UserEntity) {
    return this.professionalService.findByUserId(user.id);
  }

  @Post('professionals/me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create professional profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  async createProfile(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateProfessionalDto,
  ) {
    return this.professionalService.createProfile(user.id, createDto);
  }

  @Put('professionals/me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update professional profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateProfessionalDto,
  ) {
    const professional = await this.professionalService.findByUserId(user.id);
    return this.professionalService.updateProfile(user.id, professional.id, updateDto);
  }

  @Post('professionals/me/profile/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add image or video to professional gallery' })
  @ApiResponse({ status: 200, description: 'Gallery item added successfully' })
  async addGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() addDto: AddGalleryItemDto,
  ) {
    return this.professionalService.addGalleryItem(user.id, addDto.url);
  }

  @Delete('professionals/me/profile/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove image or video from professional gallery' })
  @ApiResponse({ status: 200, description: 'Gallery item removed successfully' })
  async removeGalleryItem(
    @CurrentUser() user: UserEntity,
    @Body() addDto: AddGalleryItemDto,
  ) {
    return this.professionalService.removeGalleryItem(user.id, addDto.url);
  }

  // Requests endpoints
  @Post('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a service request' })
  @ApiResponse({ status: 201, description: 'Request created successfully' })
  async createRequest(@CurrentUser() user: UserEntity, @Body() createDto: CreateRequestDto) {
    return this.requestService.create(user.id, createDto);
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my requests' })
  @ApiResponse({ status: 200, description: 'List of requests' })
  async getMyRequests(@CurrentUser() user: UserEntity) {
    // User entity should already have profile flags loaded from JWT strategy
    if (user.isClient()) {
      return this.requestService.findByClientId(user.id);
    } else if (user.isProfessional()) {
      const professional = await this.professionalService.findByUserId(user.id);
      return this.requestService.findByProfessionalId(professional.id);
    }
    return [];
  }

  @Get('requests/public')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get public requests for specialists' })
  @ApiResponse({ status: 200, description: 'List of public requests' })
  async getPublicRequests(@CurrentUser() user: UserEntity) {
    if (!user.hasProfessionalProfile) {
      throw new BadRequestException('Only specialists can view public requests');
    }

    const professional = await this.professionalService.findByUserId(user.id);
    // Return public requests that match the professional's trades
    return this.requestService.findPublicRequests(professional.tradeIds);
  }

  @Get('requests/available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available requests for professional (by trade and location)' })
  @ApiResponse({ status: 200, description: 'List of available requests' })
  async getAvailableRequests(
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

  @Get('requests/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get request by ID' })
  @ApiResponse({ status: 200, description: 'Request details' })
  async getRequest(@Param('id') id: string) {
    return this.requestService.findById(id);
  }

  @Put('requests/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update request status (professional only)' })
  @ApiResponse({ status: 200, description: 'Request updated successfully' })
  async updateRequestStatus(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateRequestDto,
  ) {
    return this.requestService.updateStatus(id, user.id, updateDto);
  }

  @Put('requests/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept quote (client only)' })
  @ApiResponse({ status: 200, description: 'Quote accepted successfully' })
  async acceptQuote(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.requestService.acceptQuote(id, user.id);
  }

  @Put('requests/:id/client-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update request status (client only - cancel/accept)' })
  @ApiResponse({ status: 200, description: 'Request updated successfully' })
  async updateRequestStatusByClient(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateRequestDto,
  ) {
    return this.requestService.updateStatusByClient(id, user.id, updateDto);
  }

  @Post('requests/:id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add photo or video to request (client or professional)' })
  @ApiResponse({ status: 200, description: 'Photo added successfully' })
  async addRequestPhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() addDto: AddRequestPhotoDto,
  ) {
    return this.requestService.addRequestPhoto(id, user.id, addDto.url);
  }

  @Delete('requests/:id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove photo or video from request (client or professional)' })
  @ApiResponse({ status: 200, description: 'Photo removed successfully' })
  async removeRequestPhoto(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() addDto: AddRequestPhotoDto,
  ) {
    return this.requestService.removeRequestPhoto(id, user.id, addDto.url);
  }

  // Request Interest endpoints (for public requests)
  @Post('requests/:id/interest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Express interest in a public request (specialist only)' })
  @ApiResponse({ status: 201, description: 'Interest expressed successfully' })
  async expressInterest(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: ExpressInterestDto,
  ) {
    return this.requestInterestService.expressInterest(id, user.id, dto);
  }

  @Delete('requests/:id/interest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove interest from a public request (specialist only)' })
  @ApiResponse({ status: 204, description: 'Interest removed successfully' })
  async removeInterest(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    await this.requestInterestService.removeInterest(id, user.id);
  }

  @Get('requests/:id/interests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all interested specialists for a request (client only)' })
  @ApiResponse({ status: 200, description: 'List of interested specialists' })
  async getInterestedProfessionals(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.requestInterestService.getInterestedProfessionals(id, user.id);
  }

  @Get('requests/:id/my-interest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user has expressed interest' })
  @ApiResponse({ status: 200, description: 'Interest status' })
  async checkMyInterest(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const hasInterest = await this.requestInterestService.hasExpressedInterest(id, user.id);
    return { hasInterest };
  }

  @Post('requests/:id/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a specialist to a public request (client only)' })
  @ApiResponse({ status: 200, description: 'Specialist assigned successfully' })
  async assignProfessional(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Body() dto: AssignProfessionalDto,
  ) {
    return this.requestInterestService.assignProfessional(id, user.id, dto.professionalId);
  }
}

