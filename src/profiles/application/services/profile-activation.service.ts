import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UserService } from '../../../identity/application/services/user.service';
import { ProfessionalService } from './professional.service';
import { CompanyService } from './company.service';

/**
 * Result of the single orchestration point for "active profile" per user.
 * Used to build AuthContexts; no other module should duplicate this logic.
 */
export interface UserProfileActivationStatus {
  hasActiveClientProfile: boolean;
  hasActiveProviderProfile: boolean;
  /** ServiceProvider ID of the active provider profile (Professional or Company), if any */
  activeServiceProviderId: string | null;
}

/**
 * Single orchestration point for "perfil activo" (cliente y proveedor).
 * Composes User (Identity) and Professional/Company (Profiles); no other service
 * should call user.isFullyVerified() for permission checks — use this service instead.
 */
@Injectable()
export class ProfileActivationService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => ProfessionalService))
    private readonly professionalService: ProfessionalService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
  ) {}

  /**
   * Returns activation status for the given user: client and provider "active" flags
   * and the active provider's serviceProviderId. Used to build RequestAuthContext and
   * to validate create request / express interest without duplicating logic.
   */
  async getActivationStatus(
    userId: string,
  ): Promise<UserProfileActivationStatus> {
    const user = await this.userService.findById(userId, true);
    if (!user) {
      return {
        hasActiveClientProfile: false,
        hasActiveProviderProfile: false,
        activeServiceProviderId: null,
      };
    }

    const hasActiveClientProfile =
      user.hasClientProfile && user.isFullyVerified();

    let professional: Awaited<
      ReturnType<ProfessionalService['findByUserId']>
    > | null = null;
    let company: Awaited<ReturnType<CompanyService['findByUserId']>> | null =
      null;

    try {
      professional = await this.professionalService.findByUserId(userId);
    } catch {
      // No professional profile
    }
    try {
      company = await this.companyService.findByUserId(userId);
    } catch {
      // No company profile
    }

    const profileCanOperate =
      (professional?.canOperate?.() ?? false) || (company?.canOperate?.() ?? false);
    const hasActiveProviderProfile =
      user.isFullyVerified() && profileCanOperate;

    const activeServiceProviderId = hasActiveProviderProfile
      ? professional?.canOperate?.()
        ? professional!.serviceProviderId
        : company!.serviceProviderId
      : null;

    return {
      hasActiveClientProfile,
      hasActiveProviderProfile,
      activeServiceProviderId: activeServiceProviderId ?? null,
    };
  }
}
