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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from '../application/admin.service';
import { UpdateUserStatusDto } from '../application/dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from '../application/dto/update-professional-status.dto';
import { JwtAuthGuard } from '../../shared/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';

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
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user status (Admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, updateDto);
  }

  @Get('professionals')
  @ApiOperation({ summary: 'Get all professional profiles (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Professional profiles retrieved successfully' })
  async getAllProfessionals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllProfessionals(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Put('professionals/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update professional status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Professional status updated successfully' })
  async updateProfessionalStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateProfessionalStatusDto,
  ) {
    return this.adminService.updateProfessionalStatus(id, updateDto);
  }

}
