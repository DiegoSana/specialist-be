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
} from '@nestjs/swagger';
import { ClientService } from '../../profiles/application/services/client.service';
import { UpdateUserDto } from '../../profiles/application/dto/update-user.dto';
import { UserProfileResponseDto } from '../../profiles/application/dto/user-profile-response.dto';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../domain/entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly clientService: ClientService) {}

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
}
