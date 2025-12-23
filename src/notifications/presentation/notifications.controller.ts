import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { InAppNotificationService } from '../application/services/in-app-notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.query';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly inApp: InAppNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List my in-app notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async list(
    @CurrentUser() user: UserEntity,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.inApp.listForUser(user.id, {
      unreadOnly: query.unreadOnly,
      take: query.take,
    });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markRead(@CurrentUser() user: UserEntity, @Param('id') id: string) {
    return this.inApp.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllRead(@CurrentUser() user: UserEntity) {
    return this.inApp.markAllRead(user.id);
  }
}

