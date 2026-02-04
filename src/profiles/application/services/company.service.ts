import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  CompanyRepository,
  COMPANY_REPOSITORY,
} from '../../domain/repositories/company.repository';
import {
  CompanyQueryRepository,
  COMPANY_QUERY_REPOSITORY,
} from '../../domain/queries/company.query-repository';
import {
  TradeRepository,
  TRADE_REPOSITORY,
} from '../../domain/repositories/trade.repository';
import {
  CompanyEntity,
  CompanyAuthContext,
  CompanyStatus,
} from '../../domain/entities/company.entity';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { SearchCompaniesDto } from '../dto/search-companies.dto';
import { randomUUID } from 'crypto';
import { UserService } from '../../../identity/application/services/user.service';
import { UserEntity } from '../../../identity/domain/entities/user.entity';
import { ProfileToggleService } from './profile-toggle.service';

@Injectable()
export class CompanyService {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: CompanyRepository,
    @Inject(COMPANY_QUERY_REPOSITORY)
    private readonly companyQueryRepository: CompanyQueryRepository,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: TradeRepository,
    @Inject(forwardRef(() => ProfileToggleService))
    private readonly profileToggleService: ProfileToggleService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Helper: Build auth context from user
  // ─────────────────────────────────────────────────────────────
  private buildAuthContext(user: UserEntity): CompanyAuthContext {
    return {
      userId: user.id,
      isAdmin: user.isAdminUser(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Helper: Sanitize company for public display (remove contact info)
  // ─────────────────────────────────────────────────────────────
  private sanitizeForPublic(company: CompanyEntity): CompanyEntity {
    return new CompanyEntity(
      company.id,
      company.userId,
      company.serviceProviderId,
      company.companyName,
      null, // legalName - private
      null, // taxId - private
      company.trades,
      company.description,
      company.foundedYear,
      company.employeeCount,
      null, // website - requires active request
      null, // phone - requires active request
      null, // email - requires active request
      null, // address - requires active request
      company.city,
      company.zone,
      company.status,
      company.profileImage,
      company.gallery,
      company.active,
      company.createdAt,
      company.updatedAt,
      company.serviceProvider,
      (company as any).user,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Public Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Search companies (public endpoint)
   */
  async search(searchDto: SearchCompaniesDto): Promise<CompanyEntity[]> {
    const companies = await this.companyRepository.search({
      search: searchDto.search,
      tradeId: searchDto.tradeId,
      city: searchDto.city,
      verified: searchDto.verified,
      active: true, // Only show active companies
    });

    // Sanitize contact info for public display
    return companies.map((c) => this.sanitizeForPublic(c));
  }

  /**
   * Get company by ID (public endpoint)
   */
  async findById(id: string): Promise<CompanyEntity> {
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Sanitize for public display
    return this.sanitizeForPublic(company);
  }

  /**
   * Get company by ID (internal - no sanitization)
   */
  async getByIdOrFail(id: string): Promise<CompanyEntity> {
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  /**
   * Find company by user ID (owner access - full info)
   */
  async findByUserId(userId: string): Promise<CompanyEntity> {
    const company = await this.companyRepository.findByUserId(userId);
    if (!company) {
      throw new NotFoundException('Company profile not found');
    }
    return company;
  }

  /**
   * Find company by service provider ID
   */
  async findByServiceProviderId(serviceProviderId: string): Promise<CompanyEntity | null> {
    return this.companyRepository.findByServiceProviderId(serviceProviderId);
  }

  /**
   * Create company profile for user
   */
  async createProfile(
    userId: string,
    createDto: CreateCompanyDto,
  ): Promise<{ company: CompanyEntity; user: any }> {
    const user = await this.userService.findByIdOrFail(userId, true);

    if (!user.isActive()) {
      throw new BadRequestException('User account is not active');
    }

    // Check if company profile already exists
    const existing = await this.companyRepository.findByUserId(userId);
    if (existing) {
      throw new BadRequestException('Company profile already exists');
    }

    // Validate CUIT uniqueness if provided
    if (createDto.taxId) {
      const existingByTaxId = await this.companyRepository.findByTaxId(createDto.taxId);
      if (existingByTaxId) {
        throw new BadRequestException('Esta empresa ya está registrada (CUIT duplicado)');
      }
    }

    // Verify all trades exist
    const trades: {
      id: string;
      name: string;
      category: string | null;
      description: string | null;
    }[] = [];
    for (const tradeId of createDto.tradeIds) {
      const trade = await this.tradeRepository.findById(tradeId);
      if (!trade) {
        throw new NotFoundException(`Trade with ID ${tradeId} not found`);
      }
      trades.push({
        id: trade.id,
        name: trade.name,
        category: trade.category,
        description: trade.description,
      });
    }

    const now = new Date();
    const companyId = randomUUID();
    const serviceProviderId = randomUUID();

    const company = await this.companyRepository.save(
      new CompanyEntity(
        companyId,
        userId,
        serviceProviderId,
        createDto.companyName,
        createDto.legalName || null,
        createDto.taxId || null,
        trades.map((t, index) => ({
          ...t,
          isPrimary: index === 0,
        })),
        createDto.description || null,
        createDto.foundedYear || null,
        createDto.employeeCount || null,
        createDto.website || null,
        createDto.phone || null,
        createDto.email || null,
        createDto.address || null,
        createDto.city || 'Bariloche',
        createDto.zone || null,
        CompanyStatus.PENDING_VERIFICATION,
        createDto.profileImage || null,
        createDto.gallery || [],
        true, // active
        now,
        now,
      ),
    );

    // Update trades with isPrimary
    const primaryTradeId = createDto.tradeIds[0];
    await (this.companyRepository as any).updateTrades(
      company.id,
      createDto.tradeIds,
      primaryTradeId,
    );

    // Reload user with updated profiles
    const updatedUser = await this.userService.findById(userId, true);
    return {
      company,
      user: updatedUser
        ? {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            status: updatedUser.status,
            hasClientProfile: updatedUser.hasClientProfile,
            hasProfessionalProfile: updatedUser.hasProfessionalProfile,
            hasCompanyProfile: updatedUser.hasCompanyProfile,
            isAdmin: updatedUser.isAdminUser(),
          }
        : null,
    };
  }

  /**
   * Update company profile
   */
  async updateProfile(
    actingUser: UserEntity,
    companyId: string,
    updateDto: UpdateCompanyDto,
  ): Promise<CompanyEntity> {
    const company = await this.getByIdOrFail(companyId);
    const ctx = this.buildAuthContext(actingUser);

    if (!company.canBeEditedBy(ctx)) {
      throw new ForbiddenException('You can only update your own company profile');
    }

    // Handle trade updates
    let nextTrades = company.trades;
    if (updateDto.tradeIds && updateDto.tradeIds.length > 0) {
      const trades: {
        id: string;
        name: string;
        category: string | null;
        description: string | null;
      }[] = [];
      for (const tradeId of updateDto.tradeIds) {
        const trade = await this.tradeRepository.findById(tradeId);
        if (!trade) {
          throw new NotFoundException(`Trade with ID ${tradeId} not found`);
        }
        trades.push({
          id: trade.id,
          name: trade.name,
          category: trade.category,
          description: trade.description,
        });
      }
      nextTrades = trades.map((t, index) => ({
        ...t,
        isPrimary: index === 0,
      }));

      // Update trades in database
      await (this.companyRepository as any).updateTrades(
        companyId,
        updateDto.tradeIds,
        updateDto.tradeIds[0],
      );
    }

    const now = new Date();
    return this.companyRepository.save(
      new CompanyEntity(
        company.id,
        company.userId,
        company.serviceProviderId,
        updateDto.companyName ?? company.companyName,
        updateDto.legalName !== undefined ? updateDto.legalName : company.legalName,
        updateDto.taxId !== undefined ? updateDto.taxId : company.taxId,
        nextTrades,
        updateDto.description !== undefined ? updateDto.description : company.description,
        updateDto.foundedYear !== undefined ? updateDto.foundedYear : company.foundedYear,
        updateDto.employeeCount !== undefined ? updateDto.employeeCount : company.employeeCount,
        updateDto.website !== undefined ? updateDto.website : company.website,
        updateDto.phone !== undefined ? updateDto.phone : company.phone,
        updateDto.email !== undefined ? updateDto.email : company.email,
        updateDto.address !== undefined ? updateDto.address : company.address,
        updateDto.city !== undefined ? updateDto.city : company.city,
        updateDto.zone !== undefined ? updateDto.zone : company.zone,
        company.status,
        updateDto.profileImage !== undefined ? updateDto.profileImage : company.profileImage,
        updateDto.gallery !== undefined ? updateDto.gallery : company.gallery,
        company.active,
        company.createdAt,
        now,
        company.serviceProvider,
      ),
    );
  }

  /**
   * Add gallery item
   */
  async addGalleryItem(user: UserEntity, url: string): Promise<CompanyEntity> {
    const ctx = this.buildAuthContext(user);
    const company = await this.companyRepository.findByUserId(user.id);

    if (!company) {
      throw new NotFoundException('Company profile not found');
    }

    if (!company.canManageGalleryBy(ctx)) {
      throw new ForbiddenException('You can only manage your own gallery');
    }

    const currentGallery = company.gallery || [];
    if (currentGallery.includes(url)) {
      throw new BadRequestException('This image is already in the gallery');
    }

    const updatedGallery = [...currentGallery, url];

    return this.companyRepository.save(
      new CompanyEntity(
        company.id,
        company.userId,
        company.serviceProviderId,
        company.companyName,
        company.legalName,
        company.taxId,
        company.trades,
        company.description,
        company.foundedYear,
        company.employeeCount,
        company.website,
        company.phone,
        company.email,
        company.address,
        company.city,
        company.zone,
        company.status,
        company.profileImage,
        updatedGallery,
        company.active,
        company.createdAt,
        new Date(),
        company.serviceProvider,
      ),
    );
  }

  /**
   * Remove gallery item
   */
  async removeGalleryItem(user: UserEntity, url: string): Promise<CompanyEntity> {
    const ctx = this.buildAuthContext(user);
    const company = await this.companyRepository.findByUserId(user.id);

    if (!company) {
      throw new NotFoundException('Company profile not found');
    }

    if (!company.canManageGalleryBy(ctx)) {
      throw new ForbiddenException('You can only manage your own gallery');
    }

    const currentGallery = company.gallery || [];
    const updatedGallery = currentGallery.filter((item) => item !== url);

    return this.companyRepository.save(
      new CompanyEntity(
        company.id,
        company.userId,
        company.serviceProviderId,
        company.companyName,
        company.legalName,
        company.taxId,
        company.trades,
        company.description,
        company.foundedYear,
        company.employeeCount,
        company.website,
        company.phone,
        company.email,
        company.address,
        company.city,
        company.zone,
        company.status,
        company.profileImage,
        updatedGallery,
        company.active,
        company.createdAt,
        new Date(),
        company.serviceProvider,
      ),
    );
  }

  /**
   * Update company rating (called by ReviewService)
   */
  async updateRating(companyId: string, averageRating: number, totalReviews: number): Promise<void> {
    await (this.companyRepository as any).updateRating(companyId, averageRating, totalReviews);
  }

  /**
   * Verify company (admin only)
   * This activates the Company and deactivates any active Professional profile.
   */
  async verifyCompany(actingUser: UserEntity, companyId: string): Promise<CompanyEntity> {
    if (!actingUser.isAdminUser()) {
      throw new ForbiddenException('Only admins can verify companies');
    }

    const company = await this.getByIdOrFail(companyId);

    if (!company.isPending()) {
      throw new BadRequestException('Only pending companies can be verified');
    }

    // Use ProfileToggleService to handle activation and deactivation
    const result = await this.profileToggleService.handleCompanyVerification(
      company.userId,
      companyId,
    );

    return result.company;
  }

  /**
   * Activate company profile (for users who want to switch back to Company)
   */
  async activateCompanyProfile(userId: string): Promise<CompanyEntity> {
    return this.profileToggleService.activateCompanyProfile(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics methods (for admin dashboard)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get company statistics for admin dashboard
   * @returns Company statistics
   */
  async getCompanyStats() {
    return this.companyQueryRepository.getCompanyStats();
  }

  /**
   * Get all companies for admin (paginated)
   */
  async getAllCompaniesForAdmin(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const { companies, total } = await this.companyQueryRepository.findAllForAdmin({
      skip,
      take: limit,
    });

    return {
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get company by ID for admin (with full details)
   */
  async getCompanyByIdForAdmin(companyId: string) {
    const company = await this.companyQueryRepository.findByIdForAdmin(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  /**
   * Update company status (admin only)
   */
  async updateStatus(
    companyId: string,
    status: CompanyStatus,
    user: UserEntity,
  ): Promise<CompanyEntity> {
    const ctx = this.buildAuthContext(user);
    const company = await this.getByIdOrFail(companyId);

    if (!company.canChangeStatusBy(ctx)) {
      throw new ForbiddenException('Only admins can change company status');
    }

    return this.companyRepository.updateStatus(companyId, status);
  }
}
