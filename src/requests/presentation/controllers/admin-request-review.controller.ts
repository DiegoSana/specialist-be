import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { CurrentUser } from '../../../shared/presentation/decorators/current-user.decorator';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import { RequestService } from '../../application/services/request.service';
import { ResolveReviewDto } from '../../application/dto/resolve-review.dto';
import { RequestResponseDto } from '../dto/request-response.dto';

/**
 * Support flow for requests the client objected to (UNDER_REVIEW). Listing is the existing
 * `GET /admin/requests?status=UNDER_REVIEW`. MVP: there is no dedicated support role yet, so
 * this is admin-only and acts as the Soporte actor (TODO: dedicated support role).
 */
@ApiTags('Admin - Request Review')
@ApiBearerAuth()
@Controller('admin/requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminRequestReviewController {
  constructor(private readonly requestService: RequestService) {}

  @Post(':id/resolve-review')
  @ApiOperation({
    summary: 'Resolve a request under review, closing it (Admin/Support only)',
  })
  @ApiResponse({ status: 201, type: RequestResponseDto })
  async resolveReview(
    @Param('id') id: string,
    @Body() dto: ResolveReviewDto,
    @CurrentUser() user: UserEntity,
  ): Promise<RequestResponseDto> {
    const request = await this.requestService.resolveReview(
      id,
      user.id,
      dto.note,
    );
    return RequestResponseDto.fromEntity(request, {
      userId: user.id,
      isAdmin: true,
    });
  }
}
