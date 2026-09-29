import {
  Controller,
  Get,
  Post,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { AdminWhatsAppService } from '../../application/services/admin-whatsapp.service';
import { WhatsAppInteractionResponseDto } from '../dto/whatsapp-interaction-response.dto';
import { TriggerFollowUpDto } from '../dto/trigger-follow-up.dto';

/**
 * Always-registered admin endpoints for the WhatsApp conversations viewer,
 * plus the one mutating action that's safe regardless of the active
 * provider: force-triggering a follow-up rule now (`trigger-followup`). That
 * action only schedules a PENDING interaction
 * (`FollowUpSchedulerJob.forceTriggerRule`) - the actual send still goes
 * through the normal dispatch job/provider adapter, so it's a legitimate
 * "send this now" admin action, not a Twilio-simulation hack. The other
 * mutating action (simulate an inbound reply) is dev-only and lives in
 * AdminWhatsAppDevController instead, since it only makes sense against the
 * local fake provider. Every route here is always JWT + admin authenticated.
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
      'Active WhatsApp provider (twilio/local), devMode flag, the ' +
      'Twilio from-number when provider is twilio (never the account SID/auth ' +
      'token), and the available follow-up rule names (always present, used ' +
      'by the trigger-followup rule picker)',
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

  @Post('conversations/:requestId/trigger-followup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force-trigger a follow-up rule for a request right now',
  })
  @ApiResponse({ status: 200, description: '{ interactionId }' })
  @ApiResponse({ status: 404, description: 'Rule or request not found' })
  async triggerFollowUp(
    @Param('requestId') requestId: string,
    @Body() dto: TriggerFollowUpDto,
  ) {
    return this.adminWhatsAppService.triggerFollowUp(requestId, dto.ruleName);
  }
}
