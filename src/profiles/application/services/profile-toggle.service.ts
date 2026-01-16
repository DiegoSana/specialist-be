import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ProfessionalStatus } from '@prisma/client';
import {
  ProfessionalRepository,
  PROFESSIONAL_REPOSITORY,
} from '../../domain/repositories/professional.repository';
import {
  CompanyRepository,
  COMPANY_REPOSITORY,
} from '../../domain/repositories/company.repository';
import { ProfessionalEntity } from '../../domain/entities/professional.entity';
import { CompanyEntity, CompanyStatus } from '../../domain/entities/company.entity';
import { ProfileActivationPolicy } from '../../domain/services/profile-activation.policy';

/**
 * Application Service that orchestrates profile activation/deactivation.
 * 
 * Uses ProfileActivationPolicy (Domain Service) for business rules
 * and repositories for persistence.
 */
@Injectable()
export class ProfileToggleService {
  private readonly activationPolicy: ProfileActivationPolicy;

  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: CompanyRepository,
  ) {
    this.activationPolicy = new ProfileActivationPolicy();
  }

  /**
   * Activates the Company profile for a user.
   * If the user has an active Professional profile, it will be deactivated.
   * 
   * @throws BadRequestException if activation is not allowed
   * @throws NotFoundException if company profile not found
   */
  async activateCompanyProfile(userId: string): Promise<CompanyEntity> {
    const [professional, company] = await Promise.all([
      this.professionalRepository.findByUserId(userId),
      this.companyRepository.findByUserId(userId),
    ]);

    if (!company) {
      throw new NotFoundException('Company profile not found');
    }

    const result = this.activationPolicy.resolveActivation(
      'COMPANY',
      professional,
      company,
    );

    if (!result.success) {
      throw new BadRequestException(result.reason);
    }

    // Execute the deactivation first (if needed)
    if (result.deactivate) {
      await this.professionalRepository.updateStatus(
        result.deactivate.id,
        ProfessionalStatus.INACTIVE,
      );
    }

    // Then activate the company
    if (result.activate && result.activate.newStatus !== company.status) {
      return this.companyRepository.updateStatus(
        result.activate.id,
        result.activate.newStatus as CompanyStatus,
      );
    }

    return company;
  }

  /**
   * Activates the Professional profile for a user.
   * If the user has an active Company profile, it will be deactivated.
   * 
   * @throws BadRequestException if activation is not allowed
   * @throws NotFoundException if professional profile not found
   */
  async activateProfessionalProfile(userId: string): Promise<ProfessionalEntity> {
    const [professional, company] = await Promise.all([
      this.professionalRepository.findByUserId(userId),
      this.companyRepository.findByUserId(userId),
    ]);

    if (!professional) {
      throw new NotFoundException('Professional profile not found');
    }

    const result = this.activationPolicy.resolveActivation(
      'PROFESSIONAL',
      professional,
      company,
    );

    if (!result.success) {
      throw new BadRequestException(result.reason);
    }

    // Execute the deactivation first (if needed)
    if (result.deactivate) {
      await this.companyRepository.updateStatus(
        result.deactivate.id,
        CompanyStatus.INACTIVE,
      );
    }

    // Then activate the professional
    if (result.activate && result.activate.newStatus !== professional.status) {
      return this.professionalRepository.updateStatus(
        result.activate.id,
        result.activate.newStatus as ProfessionalStatus,
      );
    }

    return professional;
  }

  /**
   * Gets the currently active provider profile for a user.
   * Returns null if user has no active provider profile.
   */
  async getActiveProfile(userId: string): Promise<{
    type: 'PROFESSIONAL' | 'COMPANY' | null;
    profile: ProfessionalEntity | CompanyEntity | null;
  }> {
    const [professional, company] = await Promise.all([
      this.professionalRepository.findByUserId(userId),
      this.companyRepository.findByUserId(userId),
    ]);

    return this.activationPolicy.getActiveProfile(professional, company);
  }

  /**
   * Gets both profiles for a user with their current status.
   */
  async getUserProfiles(userId: string): Promise<{
    professional: ProfessionalEntity | null;
    company: CompanyEntity | null;
    activeType: 'PROFESSIONAL' | 'COMPANY' | null;
  }> {
    const [professional, company] = await Promise.all([
      this.professionalRepository.findByUserId(userId),
      this.companyRepository.findByUserId(userId),
    ]);

    const { type } = this.activationPolicy.getActiveProfile(professional, company);

    return {
      professional,
      company,
      activeType: type,
    };
  }

  /**
   * Handles the special case when a Company is verified by admin.
   * This triggers automatic activation and deactivation of Professional if needed.
   * 
   * Called by CompanyService.verifyCompany()
   */
  async handleCompanyVerification(userId: string, companyId: string): Promise<{
    company: CompanyEntity;
    deactivatedProfessional: boolean;
  }> {
    const [professional, company] = await Promise.all([
      this.professionalRepository.findByUserId(userId),
      this.companyRepository.findById(companyId),
    ]);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const result = this.activationPolicy.resolveCompanyVerification(
      professional,
      company,
    );

    if (!result.success) {
      throw new BadRequestException(result.reason);
    }

    let deactivatedProfessional = false;

    // Deactivate Professional if needed
    if (result.deactivate) {
      await this.professionalRepository.updateStatus(
        result.deactivate.id,
        ProfessionalStatus.INACTIVE,
      );
      deactivatedProfessional = true;
    }

    // Activate Company
    const updatedCompany = await this.companyRepository.updateStatus(
      result.activate!.id,
      result.activate!.newStatus as CompanyStatus,
    );

    return {
      company: updatedCompany,
      deactivatedProfessional,
    };
  }
}

