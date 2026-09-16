import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { AdminWhatsAppService } from '../../application/services/admin-whatsapp.service';
import { WhatsAppInteractionResponseDto } from '../dto/whatsapp-interaction-response.dto';

/**
 * Always-registered, read-only admin endpoints for the WhatsApp conversations
 * viewer. The dev-only mutating endpoints (simulate a reply, force-trigger a
 * follow-up) live in AdminWhatsAppDevController for defense-in-depth: this
 * controller has no code path that can send/alter a real conversation.
 */
@ApiTags('Admin - WhatsApp')
@ApiBearerAuth()
@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminWhatsAppController {
  constructor(private readonly adminWhatsAppService: AdminWhatsAppService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get WhatsApp admin config (Admin only)' })
  @ApiResponse({
    status: 200,
    description:
      'devMode flag and, when in dev mode, available follow-up rule names',
  })
  async getConfig() {
    return this.adminWhatsAppService.getConfig();
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List WhatsApp conversations (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter by request title, client name or provider name',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of conversation summaries',
  })
  async listConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const { items, total } = await this.adminWhatsAppService.listConversations({
      page: pageNum,
      limit: limitNum,
      search,
    });

    return {
      data: items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get('conversations/:requestId')
  @ApiOperation({
    summary: 'Get the full WhatsApp message thread for a request (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Interactions for the request, most recent first',
    type: [WhatsAppInteractionResponseDto],
  })
  async getThread(@Param('requestId') requestId: string) {
    const interactions = await this.adminWhatsAppService.getThread(requestId);
    return WhatsAppInteractionResponseDto.fromEntities(interactions);
  }
}
