import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../shared/presentation/guards/admin.guard';
import { AdminVerificationService } from '../application/services/admin-verification.service';

/**
 * Always-registered admin endpoint reporting the active phone/email verification (OTP)
 * provider, mirrors AdminWhatsAppController's `GET config`.
 */
@ApiTags('Admin - Verification')
@ApiBearerAuth()
@Controller('admin/verification')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminVerificationController {
  constructor(
    private readonly adminVerificationService: AdminVerificationService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get verification (OTP) admin config (Admin only)' })
  @ApiResponse({
    status: 200,
    description:
      'Active verification provider (twilio/local) and the fixed dev OTP code when provider is local',
  })
  async getConfig() {
    return this.adminVerificationService.getConfig();
  }
}
