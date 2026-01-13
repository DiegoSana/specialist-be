import {
  Controller,
  Post,
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
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { ClientService } from '../application/services/client.service';
import { UserProfileResponseDto } from '../application/dto/user-profile-response.dto';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create my client profile' })
  @ApiResponse({
    status: 201,
    description: 'Client profile created successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Client profile already exists' })
  async createClientProfile(
    @CurrentUser() user: UserEntity,
  ): Promise<UserProfileResponseDto> {
    const entity = await this.clientService.activateClientProfile(user.id);
    return UserProfileResponseDto.fromEntity(entity);
  }
}
