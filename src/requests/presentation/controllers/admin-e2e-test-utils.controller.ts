import { Controller, Delete, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../../shared/presentation/guards/admin.guard';
import { AdminE2eTestUtilsService } from '../../application/services/admin-e2e-test-utils.service';
import { E2eCleanupQueryDto } from '../dto/e2e-cleanup-query.dto';

/**
 * Dev/CI-only admin endpoint backing `specialist-e2e`'s `global-teardown.ts`: bulk-deletes
 * every Request whose title starts with the given prefix (cascading to RequestInterest, Review,
 * RequestAttentionFlag and RequestInteraction via `onDelete: Cascade` at the DB level), so each
 * E2E run's `[E2E]`-tagged data doesn't pile up in the dev/CI database. `Contact` is unrelated
 * (user-to-user, not tied to Request) and is intentionally left untouched.
 *
 * This controller is registered ONLY when `E2E_TEST_UTILS_ENABLED === 'true'` (see
 * requests.module.ts) so on any environment where that var is unset (including the Fly.io
 * "production" deploy) this route 404s at Nest's routing layer, before any handler runs. On top
 * of that, the handler also calls through `AdminE2eTestUtilsService`, which re-checks the same
 * flag (belt-and-suspenders, mirrors `AdminWhatsAppDevController`/`isWhatsAppDevMode`). Both
 * cases return 404 (`NotFoundException`), never 403, when disabled - a production-like
 * environment should reveal nothing about the feature's existence.
 */
@ApiTags('Admin - E2E test utils (dev)')
@ApiBearerAuth()
@Controller('requests/test-utils')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminE2eTestUtilsController {
  constructor(
    private readonly adminE2eTestUtilsService: AdminE2eTestUtilsService,
  ) {}

  @Delete('e2e-data')
  @ApiOperation({
    summary:
      'Delete every Request whose title starts with titlePrefix (dev/CI only)',
  })
  @ApiResponse({ status: 200, description: '{ deletedCount: number }' })
  @ApiResponse({
    status: 404,
    description: 'E2E test utils are disabled in this environment',
  })
  async deleteE2eData(@Query() query: E2eCleanupQueryDto) {
    const deletedCount =
      await this.adminE2eTestUtilsService.deleteRequestsByTitlePrefix(
        query.titlePrefix,
      );
    return { deletedCount };
  }
}
