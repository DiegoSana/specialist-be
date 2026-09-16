import {
  Controller,
  Post,
  Param,
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
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { AdminWhatsAppService } from '../../application/services/admin-whatsapp.service';
import { SimulateReplyDto } from '../dto/simulate-reply.dto';
import { TriggerFollowUpDto } from '../dto/trigger-follow-up.dto';
import { WhatsAppInteractionResponseDto } from '../dto/whatsapp-interaction-response.dto';

/**
 * Dev-only mutating endpoints for the local (no-Twilio) WhatsApp test loop:
 * simulate an inbound reply, or force-trigger a follow-up rule immediately.
 *
 * This controller is registered ONLY when NODE_ENV !== 'production' OR
 * WHATSAPP_DEV_MODE_ENABLED === 'true' (see requests.module.ts) so on a real
 * production deploy these routes 404 at Nest's routing layer, before any
 * handler runs. On top of that, every handler also calls through
 * AdminWhatsAppService.isDevMode() (belt-and-suspenders requiring
 * WHATSAPP_PROVIDER=local, so an environment pointed at a real/staging Twilio
 * backend never gets dev endpoints even with WHATSAPP_DEV_MODE_ENABLED set).
 * Both cases return 404 (NotFoundException), never 403, when dev mode is off -
 * a production-like environment should reveal nothing about the feature's
 * existence.
 */
@ApiTags('Admin - WhatsApp (dev)')
@ApiBearerAuth()
@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminWhatsAppDevController {
  constructor(private readonly adminWhatsAppService: AdminWhatsAppService) {}

  @Post('conversations/:requestId/simulate-reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate an inbound WhatsApp reply for a request (dev mode only)',
  })
  @ApiResponse({ status: 200, description: 'Updated interaction (or null)' })
  @ApiResponse({
    status: 404,
    description: 'Not in dev mode, or nothing to reply to',
  })
  async simulateReply(
    @Param('requestId') requestId: string,
    @Body() dto: SimulateReplyDto,
  ) {
    const interaction = await this.adminWhatsAppService.simulateReply(
      requestId,
      dto.body,
    );
    return interaction
      ? WhatsAppInteractionResponseDto.fromEntity(interaction)
      : null;
  }

  @Post('conversations/:requestId/trigger-followup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Force-trigger a follow-up rule for a request right now (dev mode only)',
  })
  @ApiResponse({ status: 200, description: '{ interactionId }' })
  @ApiResponse({
    status: 404,
    description: 'Not in dev mode, rule, or request not found',
  })
  async triggerFollowUp(
    @Param('requestId') requestId: string,
    @Body() dto: TriggerFollowUpDto,
  ) {
    return this.adminWhatsAppService.triggerFollowUp(requestId, dto.ruleName);
  }
}
