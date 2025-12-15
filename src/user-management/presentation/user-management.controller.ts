import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserManagementService } from '../application/services/user-management.service';
import { UpdateUserDto } from '../application/dto/update-user.dto';
import { UserProfileResponseDto } from '../application/dto/user-profile-response.dto';
import { JwtAuthGuard } from '../../shared/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../domain/entities/user.entity';

@ApiTags('User Management')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully', type: UserProfileResponseDto })
  async getProfile(@CurrentUser() user: UserEntity): Promise<UserProfileResponseDto> {
    const profile = await this.userManagementService.getProfile(user.id);
    return this.toResponseDto(profile);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UserProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserProfileResponseDto> {
    const updatedProfile = await this.userManagementService.updateProfile(user.id, updateDto);
    return this.toResponseDto(updatedProfile);
  }

  private toResponseDto(user: UserEntity): UserProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePictureUrl: user.profilePictureUrl,
      isAdmin: user.isAdmin,
      status: user.status,
      hasClientProfile: user.hasClientProfile,
      hasProfessionalProfile: user.hasProfessionalProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

