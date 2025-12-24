import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { NotificationService } from '../application/services/notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.query';
import { NotificationPreferencesService } from '../application/services/notification-preferences.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my in-app notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async list(
    @CurrentUser() user: UserEntity,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const entities = await this.notifications.listForUser(user.id, {
      unreadOnly: query.unreadOnly,
      take: query.take,
    });
    return NotificationResponseDto.fromEntities(entities);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markRead(@CurrentUser() user: UserEntity, @Param('id') id: string) {
    const entity = await this.notifications.markRead(user.id, id);
    return NotificationResponseDto.fromEntity(entity);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllRead(@CurrentUser() user: UserEntity) {
    return this.notifications.markAllRead(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  async getPreferences(@CurrentUser() user: UserEntity) {
    return this.preferences.getForUser(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated notification preferences' })
  async updatePreferences(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.preferences.upsertForUser(user.id, {
      inAppEnabled: dto.inAppEnabled,
      externalEnabled: dto.externalEnabled,
      preferredExternalChannel: dto.preferredExternalChannel,
      overrides: dto.overrides,
    });
  }
}
