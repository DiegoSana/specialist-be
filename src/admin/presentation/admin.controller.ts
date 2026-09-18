import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from '../application/admin.service';
import { UpdateUserStatusDto } from '../application/dto/update-user-status.dto';
import { UpdateUserVerificationDto } from '../application/dto/update-user-verification.dto';
import { UpdateUserWhatsAppOptOutDto } from '../application/dto/update-user-whatsapp-opt-out.dto';
import { UpdateProfessionalStatusDto } from '../application/dto/update-professional-status.dto';
import { UpdateCompanyStatusDto } from '../application/dto/update-company-status.dto';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { AdminRequestDetailResponseDto } from './dto/admin-request-detail-response.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive match on email, firstName or lastName',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['CLIENT', 'PROFESSIONAL', 'COMPANY'],
    description: 'Filter to users who have this profile type',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: 'CLIENT' | 'PROFESSIONAL' | 'COMPANY',
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
      type,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  async getUserById(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.adminService.getUserById(id, user);
  }

  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.updateUserStatus(id, updateDto, user);
  }

  @Put('users/:id/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user verification (Admin only)',
    description:
      'Manually confirm email and/or phone as verified. Used when admin overrides Twilio verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'User verification updated successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserVerification(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserVerificationDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.updateUserVerification(id, updateDto, user);
  }

  @Put('users/:id/whatsapp-opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually set/clear a user WhatsApp opt-out (Admin only)',
    description:
      'Manual override for User.whatsappOptedOut. Setting it true blocks the user from ' +
      'creating/taking new requests (see ProfileActivationService) and triggers a ' +
      'notification telling them so; clearing it does not notify.',
  })
  @ApiResponse({
    status: 200,
    description: 'User WhatsApp opt-out updated successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserWhatsAppOptOut(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserWhatsAppOptOutDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.updateUserWhatsAppOptOut(id, updateDto, user);
  }

  @Get('professionals')
  @ApiOperation({ summary: 'Get all professional profiles (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Professional profiles retrieved successfully',
  })
  async getAllProfessionals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllProfessionals(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('professionals/:id')
  @ApiOperation({ summary: 'Get professional by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Professional profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Professional not found' })
  async getProfessionalById(@Param('id') id: string) {
    return this.adminService.getProfessionalById(id);
  }

  @Put('professionals/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update professional status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Professional status updated successfully',
  })
  async updateProfessionalStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateProfessionalStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.updateProfessionalStatus(id, updateDto, user);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get all requests (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  })
  @ApiQuery({ name: 'title', required: false, type: String })
  @ApiQuery({
    name: 'client',
    required: false,
    type: String,
    description: 'Client first name, last name or email (case-insensitive)',
  })
  @ApiQuery({
    name: 'provider',
    required: false,
    type: String,
    description: 'Professional name or company name (case-insensitive)',
  })
  @ApiResponse({ status: 200, description: 'Requests retrieved successfully' })
  async getAllRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('title') title?: string,
    @Query('client') client?: string,
    @Query('provider') provider?: string,
  ) {
    return this.adminService.getAllRequests(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      status as any,
      { title, client, provider },
    );
  }

  @Get('requests/:id')
  @ApiOperation({
    summary: 'Get request by ID, full admin detail (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Request retrieved successfully',
    type: AdminRequestDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getRequestById(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.getRequestByIdForAdmin(id, user);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Get all companies (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Companies retrieved successfully',
  })
  async getAllCompanies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllCompanies(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyById(@Param('id') id: string) {
    return this.adminService.getCompanyById(id);
  }

  @Put('companies/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company status updated successfully',
  })
  async updateCompanyStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateCompanyStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.adminService.updateCompanyStatus(id, updateDto, user);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }
}
