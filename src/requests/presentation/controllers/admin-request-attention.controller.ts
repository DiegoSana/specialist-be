import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
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
import { CurrentUser } from '../../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import { AdminRequestAttentionService } from '../../application/services/admin-request-attention.service';

/**
 * Admin "needs attention" panel: requests flagged AT_RISK (silence past the
 * follow-up ladder), ABANDONED (evasive reply) or ESCALATED (explicit
 * escalation), from RequestAttentionService. Read-only listing plus resolve —
 * the admin follows up manually via the existing WhatsApp conversations viewer.
 */
@ApiTags('Admin - Request Attention')
@ApiBearerAuth()
@Controller('admin/requests/attention')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminRequestAttentionController {
  constructor(
    private readonly attentionService: AdminRequestAttentionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List requests that need admin attention (Admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of open attention flags',
  })
  async listOpen(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const { items, total } = await this.attentionService.listOpen({
      page: pageNum,
      limit: limitNum,
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

  @Post(':id/resolve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark an attention flag as resolved (Admin only)' })
  @ApiResponse({ status: 204, description: 'Flag resolved' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.attentionService.resolve(id, user.id);
  }
}
