import {
  Controller,
  Get,
  Post,
  Param,
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
import { JwtAuthGuard } from '../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { NotificationService } from '../application/services/notification.service';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Admin - Notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List all notifications (Admin only)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by notification type' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'hasFailedDelivery', required: false, type: Boolean })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max 100' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of notifications with pagination' })
  async listAll(
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('hasFailedDelivery') hasFailedDelivery?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const result = await this.notifications.listAll({
      userId,
      type,
      unreadOnly: unreadOnly === 'true',
      hasFailedDelivery: hasFailedDelivery === 'true',
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });

    return {
      items: NotificationResponseDto.fromEntities(result.items),
      total: result.total,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification delivery statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total notifications' },
        byStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Count by delivery status',
        },
        byChannel: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Count by channel',
        },
        failedLast24h: { type: 'number', description: 'Failed deliveries in last 24h' },
        pendingExternal: { type: 'number', description: 'Pending external deliveries' },
      },
    },
  })
  async getStats() {
    return this.notifications.getDeliveryStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    const entity = await this.notifications.findByIdForUser(id, user);
    return NotificationResponseDto.fromEntity(entity);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend failed notification (Admin only)' })
  @ApiResponse({ status: 200, description: 'Notification marked for resend' })
  @ApiResponse({ status: 403, description: 'Cannot resend this notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async resend(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ) {
    const entity = await this.notifications.resendNotification(id, user);
    return NotificationResponseDto.fromEntity(entity);
  }
}

