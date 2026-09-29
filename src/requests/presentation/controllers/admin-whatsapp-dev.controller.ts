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
import { WhatsAppInteractionResponseDto } from '../dto/whatsapp-interaction-response.dto';

/**
 * Dev-only mutating endpoint for the local (no-Twilio) WhatsApp test loop:
 * simulate an inbound reply. Against a real Twilio number, real inbound
 * replies arrive via the `/api/webhooks/twilio` webhook, so faking one here
 * doesn't make sense and could desync state - this stays a local-provider-
 * only test tool. (Force-triggering a follow-up rule is a different, always-
 * safe admin action and lives in AdminWhatsAppController instead.)
 *
 * This controller is registered ONLY when NODE_ENV !== 'production' OR
 * WHATSAPP_DEV_MODE_ENABLED === 'true' (see requests.module.ts) so on a real
 * production deploy this route 404s at Nest's routing layer, before any
 * handler runs. On top of that, the handler also calls through
 * AdminWhatsAppService.isDevMode() (belt-and-suspenders requiring
 * WHATSAPP_PROVIDER=local, so an environment pointed at a real/staging Twilio
 * backend never gets the dev endpoint even with WHATSAPP_DEV_MODE_ENABLED set).
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
}
