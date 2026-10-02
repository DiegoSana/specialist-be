import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REQUEST_REPOSITORY,
  RequestRepository,
} from '../../domain/repositories/request.repository';
import { isE2eTestUtilsEnabled } from './e2e-test-utils-mode';

/**
 * Admin-only, dev/CI-only bulk cleanup for E2E-created data. Backs
 * `DELETE /requests/test-utils/e2e-data`, which `specialist-e2e`'s `global-teardown.ts` already
 * calls (and currently tolerates failing, non-fatally, until this exists).
 *
 * No `canXxxBy` domain rule is involved: this is a blunt test-data operation gated purely by
 * `AdminGuard` at the route level plus this re-check, not a permission decision over a specific
 * aggregate.
 */
@Injectable()
export class AdminE2eTestUtilsService {
  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepository: RequestRepository,
    private readonly configService: ConfigService,
  ) {}

  async deleteRequestsByTitlePrefix(titlePrefix: string): Promise<number> {
    // Belt-and-suspenders: the controller is only registered when the flag is on (see
    // requests.module.ts), but re-check here too, mirroring AdminWhatsAppService.simulateReply's
    // re-check of isWhatsAppDevMode.
    if (!isE2eTestUtilsEnabled(this.configService)) {
      throw new NotFoundException('Not found');
    }

    return this.requestRepository.deleteByTitlePrefix(titlePrefix);
  }
}
