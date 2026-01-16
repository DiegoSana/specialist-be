import { ProfessionalEntity } from '../entities/professional.entity';
import { CompanyEntity, CompanyStatus } from '../entities/company.entity';
import { ProfessionalStatus } from '@prisma/client';

/**
 * Result of profile activation resolution
 */
export interface ProfileActivationResult {
  success: boolean;
  reason?: string;
  activate?: {
    type: 'PROFESSIONAL' | 'COMPANY';
    id: string;
    newStatus: ProfessionalStatus | CompanyStatus;
  };
  deactivate?: {
    type: 'PROFESSIONAL' | 'COMPANY';
    id: string;
  } | null;
}

/**
 * Domain Service that encapsulates the business rules for profile activation.
 * 
 * Key Rule: Only ONE provider profile (Professional OR Company) can be active at a time.
 * 
 * This service has NO infrastructure dependencies - it only works with domain entities.
 */
export class ProfileActivationPolicy {
  /**
   * Determines if a Company profile can be activated.
   */
  canActivateCompany(company: CompanyEntity): boolean {
    // Can activate if not rejected or suspended
    return company.status !== CompanyStatus.REJECTED &&
           company.status !== CompanyStatus.SUSPENDED;
  }

  /**
   * Determines if a Professional profile can be activated.
   */
  canActivateProfessional(professional: ProfessionalEntity): boolean {
    // Can activate if not rejected or suspended
    return professional.status !== ProfessionalStatus.REJECTED &&
           professional.status !== ProfessionalStatus.SUSPENDED;
  }

  /**
   * Resolves the activation of a provider profile, enforcing the mutual exclusion rule.
   * 
   * @param targetType - Which profile type to activate
   * @param professional - The user's professional profile (or null if none)
   * @param company - The user's company profile (or null if none)
   * @returns ProfileActivationResult with actions to take
   */
  resolveActivation(
    targetType: 'PROFESSIONAL' | 'COMPANY',
    professional: ProfessionalEntity | null,
    company: CompanyEntity | null,
  ): ProfileActivationResult {
    if (targetType === 'COMPANY') {
      return this.resolveCompanyActivation(professional, company);
    } else {
      return this.resolveProfessionalActivation(professional, company);
    }
  }

  /**
   * Resolves Company activation
   */
  private resolveCompanyActivation(
    professional: ProfessionalEntity | null,
    company: CompanyEntity | null,
  ): ProfileActivationResult {
    if (!company) {
      return {
        success: false,
        reason: 'Company profile not found',
      };
    }

    if (!this.canActivateCompany(company)) {
      return {
        success: false,
        reason: `Company cannot be activated (status: ${company.status})`,
      };
    }

    // If company is already operating, nothing to do
    if (company.canOperate()) {
      return {
        success: true,
        activate: {
          type: 'COMPANY',
          id: company.id,
          newStatus: company.status, // Keep current status
        },
        deactivate: null,
      };
    }

    // Determine the new status for Company
    // If it's PENDING_VERIFICATION, admin needs to verify first - can't self-activate
    if (company.isPending()) {
      return {
        success: false,
        reason: 'Company is pending verification. Admin must verify first.',
      };
    }

    // Company is INACTIVE, can be reactivated
    const result: ProfileActivationResult = {
      success: true,
      activate: {
        type: 'COMPANY',
        id: company.id,
        newStatus: CompanyStatus.ACTIVE,
      },
      deactivate: null,
    };

    // If Professional is currently operating, it needs to be deactivated
    if (professional?.canOperate()) {
      result.deactivate = {
        type: 'PROFESSIONAL',
        id: professional.id,
      };
    }

    return result;
  }

  /**
   * Resolves Professional activation
   */
  private resolveProfessionalActivation(
    professional: ProfessionalEntity | null,
    company: CompanyEntity | null,
  ): ProfileActivationResult {
    if (!professional) {
      return {
        success: false,
        reason: 'Professional profile not found',
      };
    }

    if (!this.canActivateProfessional(professional)) {
      return {
        success: false,
        reason: `Professional cannot be activated (status: ${professional.status})`,
      };
    }

    // If professional is already operating, nothing to do
    if (professional.canOperate()) {
      return {
        success: true,
        activate: {
          type: 'PROFESSIONAL',
          id: professional.id,
          newStatus: professional.status, // Keep current status
        },
        deactivate: null,
      };
    }

    // Determine the new status for Professional
    // If it's PENDING_VERIFICATION, for now we allow self-activation
    // (professionals don't require admin verification in MVP)
    const newStatus = professional.isPending() 
      ? ProfessionalStatus.ACTIVE 
      : ProfessionalStatus.ACTIVE;

    const result: ProfileActivationResult = {
      success: true,
      activate: {
        type: 'PROFESSIONAL',
        id: professional.id,
        newStatus,
      },
      deactivate: null,
    };

    // If Company is currently operating, it needs to be deactivated
    if (company?.canOperate()) {
      result.deactivate = {
        type: 'COMPANY',
        id: company.id,
      };
    }

    return result;
  }

  /**
   * Resolves what happens when a Company is verified by admin.
   * This is a special case where verification triggers automatic activation.
   */
  resolveCompanyVerification(
    professional: ProfessionalEntity | null,
    company: CompanyEntity,
  ): ProfileActivationResult {
    if (!company.isPending()) {
      return {
        success: false,
        reason: 'Only pending companies can be verified',
      };
    }

    const result: ProfileActivationResult = {
      success: true,
      activate: {
        type: 'COMPANY',
        id: company.id,
        newStatus: CompanyStatus.ACTIVE,
      },
      deactivate: null,
    };

    // If Professional is currently operating, it needs to be deactivated
    if (professional?.canOperate()) {
      result.deactivate = {
        type: 'PROFESSIONAL',
        id: professional.id,
      };
    }

    return result;
  }

  /**
   * Gets the currently active provider profile for a user.
   */
  getActiveProfile(
    professional: ProfessionalEntity | null,
    company: CompanyEntity | null,
  ): { type: 'PROFESSIONAL' | 'COMPANY' | null; profile: ProfessionalEntity | CompanyEntity | null } {
    // Check Company first (has priority if both somehow active)
    if (company?.canOperate()) {
      return { type: 'COMPANY', profile: company };
    }

    if (professional?.canOperate()) {
      return { type: 'PROFESSIONAL', profile: professional };
    }

    return { type: null, profile: null };
  }
}

