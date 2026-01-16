import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { ClientService } from '../../profiles/application/services/client.service';
import { ProfileToggleService } from '../../profiles/application/services/profile-toggle.service';
import { UpdateUserDto } from '../../profiles/application/dto/update-user.dto';
import { UserProfileResponseDto } from '../../profiles/application/dto/user-profile-response.dto';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../domain/entities/user.entity';

/**
 * Response DTO for provider profiles status
 */
class ProviderProfilesResponseDto {
  @ApiProperty({ example: 'PROFESSIONAL', enum: ['PROFESSIONAL', 'COMPANY', null] })
  activeType: 'PROFESSIONAL' | 'COMPANY' | null;

  @ApiProperty({ required: false })
  professional?: {
    id: string;
    status: string;
    canOperate: boolean;
  };

  @ApiProperty({ required: false })
  company?: {
    id: string;
    companyName: string;
    status: string;
    canOperate: boolean;
  };
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly clientService: ClientService,
    private readonly profileToggleService: ProfileToggleService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: UserProfileResponseDto,
  })
  async getMyProfile(
    @CurrentUser() user: UserEntity,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.clientService.getProfile(user.id);
    return UserProfileResponseDto.fromEntity(profile);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileResponseDto,
  })
  async updateMyProfile(
    @CurrentUser() user: UserEntity,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserProfileResponseDto> {
    const updatedProfile = await this.clientService.updateProfile(
      user.id,
      updateDto,
    );
    return UserProfileResponseDto.fromEntity(updatedProfile);
  }

  @Post('me/client-profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Activate client profile for current user' })
  @ApiResponse({
    status: 201,
    description: 'Client profile activated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Client profile already exists' })
  async activateClientProfile(
    @CurrentUser() user: UserEntity,
  ): Promise<UserProfileResponseDto> {
    const updatedProfile = await this.clientService.activateClientProfile(
      user.id,
    );
    return UserProfileResponseDto.fromEntity(updatedProfile);
  }

  @Get('me/provider-profiles')
  @ApiOperation({
    summary: 'Get provider profiles status',
    description:
      'Returns information about the user\'s Professional and Company profiles, ' +
      'including which one is currently active. Only one provider profile can be ' +
      'active at a time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider profiles status',
    type: ProviderProfilesResponseDto,
  })
  async getProviderProfiles(
    @CurrentUser() user: UserEntity,
  ): Promise<ProviderProfilesResponseDto> {
    const { professional, company, activeType } =
      await this.profileToggleService.getUserProfiles(user.id);

    return {
      activeType,
      professional: professional
        ? {
            id: professional.id,
            status: professional.status,
            canOperate: professional.canOperate(),
          }
        : undefined,
      company: company
        ? {
            id: company.id,
            companyName: company.companyName,
            status: company.status,
            canOperate: company.canOperate(),
          }
        : undefined,
    };
  }
}
