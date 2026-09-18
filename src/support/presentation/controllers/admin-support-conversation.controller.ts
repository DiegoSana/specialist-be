import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupportConversationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import {
  SupportConversationListStatusFilter,
  SupportConversationService,
} from '../../application/services/support-conversation.service';
import { AdminReplySupportConversationDto } from '../../application/dto/admin-reply-support-conversation.dto';
import { SupportConversationResponseDto } from '../dto/support-conversation-response.dto';
import { SupportMessageResponseDto } from '../dto/support-message-response.dto';

/**
 * Admin support conversations panel: general WhatsApp support/conversation channel,
 * independent of any Request (see src/support/CLAUDE.md). Read/reply/resolve/reopen -
 * no manual link-to-request endpoint in v1.
 */
@ApiTags('Admin - Support Conversations')
@ApiBearerAuth()
@Controller('admin/support/conversations')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSupportConversationController {
  constructor(
    private readonly supportConversationService: SupportConversationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List support conversations (Admin only)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'RESOLVED', 'ALL'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of support conversations',
  })
  async list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const statusFilter = this.parseStatusFilter(status);

    const { items, total } = await this.supportConversationService.listForAdmin(
      {
        status: statusFilter,
        page: pageNum,
        limit: limitNum,
      },
    );

    return {
      data: items.map((c) => SupportConversationResponseDto.fromEntity(c)),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a support conversation and its messages (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation plus messages, oldest first',
  })
  async getOne(@Param('id') id: string) {
    const { conversation, messages } =
      await this.supportConversationService.getForAdmin(id);

    return {
      conversation: SupportConversationResponseDto.fromEntity(conversation),
      messages: messages.map((m) => SupportMessageResponseDto.fromEntity(m)),
    };
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Send an admin reply (Admin only)' })
  @ApiResponse({ status: 201, description: 'Message sent and recorded' })
  @ApiResponse({
    status: 400,
    description:
      'Outside the WhatsApp 24h reply window (code: WHATSAPP_WINDOW_EXPIRED)',
  })
  async reply(
    @Param('id') id: string,
    @Body() dto: AdminReplySupportConversationDto,
    @CurrentUser() user: UserEntity,
  ) {
    const message = await this.supportConversationService.replyForAdmin(
      id,
      user.id,
      dto.message,
    );

    return SupportMessageResponseDto.fromEntity(message);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark a support conversation as resolved (Admin only)',
  })
  @ApiResponse({ status: 204, description: 'Conversation resolved' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.supportConversationService.resolve(id, user.id);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reopen a resolved support conversation (Admin only)',
  })
  @ApiResponse({ status: 204, description: 'Conversation reopened' })
  async reopen(@Param('id') id: string): Promise<void> {
    await this.supportConversationService.reopen(id);
  }

  private parseStatusFilter(
    status?: string,
  ): SupportConversationListStatusFilter | undefined {
    if (!status || status === 'ALL') {
      return 'ALL';
    }
    if (
      status === SupportConversationStatus.OPEN ||
      status === SupportConversationStatus.RESOLVED
    ) {
      return status;
    }
    throw new BadRequestException(
      `Invalid status filter: ${status}. Expected OPEN, RESOLVED or ALL.`,
    );
  }
}
