import { Injectable } from '@nestjs/common';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CompanyService } from '../../profiles/application/services/company.service';
import { RequestService } from '../../requests/application/services/request.service';
import { RequestInterestService } from '../../requests/application/services/request-interest.service';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { RequestStatus } from '@prisma/client';
import { AdminRequestDetailResponseDto } from '../presentation/dto/admin-request-detail-response.dto';
import { RequestResponseDto } from '../../requests/presentation/dto/request-response.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
    private readonly requestService: RequestService,
    private readonly requestInterestService: RequestInterestService,
  ) {}

  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    type?: 'CLIENT' | 'PROFESSIONAL' | 'COMPANY',
  ) {
    return this.userService.getAllUsersForAdmin(page, limit, search, type);
  }

  async getUserById(userId: string, actingUser: UserEntity) {
    const user = await this.userService.findByIdForUser(userId, actingUser);

    const [professionalId, companyId] = await Promise.all([
      this.resolveProfessionalId(userId),
      this.resolveCompanyId(userId),
    ]);

    return { ...user, professionalId, companyId };
  }

  /**
   * Resolves the Professional profile id (not the userId) for a user, or null if the
   * user has no professional profile. Mirrors ProfileActivationService.getActivationStatus'
   * catch-not-found pattern since ProfessionalService.findByUserId throws when absent.
   */
  private async resolveProfessionalId(userId: string): Promise<string | null> {
    try {
      const professional = await this.professionalService.findByUserId(userId);
      return professional.id;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the Company profile id (not the userId) for a user, or null if the user
   * has no company profile.
   */
  private async resolveCompanyId(userId: string): Promise<string | null> {
    try {
      const company = await this.companyService.findByUserId(userId);
      return company.id;
    } catch {
      return null;
    }
  }

  async updateUserStatus(
    userId: string,
    updateDto: UpdateUserStatusDto,
    actingUser: UserEntity,
  ) {
    return this.userService.updateStatusForUser(
      userId,
      actingUser,
      updateDto.status,
    );
  }

  async updateUserVerification(
    userId: string,
    updateDto: { emailVerified?: boolean; phoneVerified?: boolean },
    actingUser: UserEntity,
  ) {
    return this.userService.updateVerificationForUser(
      userId,
      actingUser,
      updateDto,
    );
  }

  async updateUserWhatsAppOptOut(
    userId: string,
    updateDto: { whatsappOptedOut: boolean },
    actingUser: UserEntity,
  ) {
    return this.userService.updateWhatsAppOptOutForUser(
      userId,
      actingUser,
      updateDto.whatsappOptedOut,
    );
  }

  async getAllProfessionals(page: number = 1, limit: number = 10) {
    return this.professionalService.getAllProfessionalsForAdmin(page, limit);
  }

  async getProfessionalById(professionalId: string) {
    return this.professionalService.getProfessionalByIdForAdmin(professionalId);
  }

  async updateProfessionalStatus(
    professionalId: string,
    updateDto: UpdateProfessionalStatusDto,
    user: UserEntity,
  ) {
    return this.professionalService.updateStatus(
      professionalId,
      updateDto.status,
      user,
    );
  }

  async getAllRequests(
    page: number = 1,
    limit: number = 10,
    status?: RequestStatus,
    filters: { title?: string; client?: string; provider?: string } = {},
  ) {
    return this.requestService.getAllRequestsForAdmin(
      page,
      limit,
      status,
      filters,
    );
  }

  /**
   * Full admin view of a single request: no `canBeViewedBy` ownership check -
   * any admin may view any request's full detail (client, provider, interests).
   */
  async getRequestByIdForAdmin(
    requestId: string,
    actingUser: UserEntity,
  ): Promise<AdminRequestDetailResponseDto> {
    const request = await this.requestService.findById(requestId);
    const interestedProviders =
      await this.requestInterestService.getInterestedProviders(requestId, {
        userId: actingUser.id,
        isAdmin: true,
      });

    return AdminRequestDetailResponseDto.fromEntity(
      request,
      interestedProviders,
    );
  }

  /**
   * Admin override: moves a request to any status. RequestEntity.canChangeStatusBy grants
   * admins an unconditional bypass, so no additional validation is done here beyond what
   * RequestService.updateStatus already enforces (notification side-effects, actor-kind
   * resolution). Builds the auth context directly (lightweight admin pattern used elsewhere
   * in this service) rather than the heavier async RequestService.buildAuthContext.
   */
  async updateRequestStatus(
    requestId: string,
    updateDto: UpdateRequestStatusDto,
    actingUser: UserEntity,
  ): Promise<RequestResponseDto> {
    const ctx = { userId: actingUser.id, isAdmin: true };
    const entity = await this.requestService.updateStatus(
      requestId,
      ctx,
      updateDto,
    );
    return RequestResponseDto.fromEntity(entity, ctx);
  }

  async getAllCompanies(page: number = 1, limit: number = 10) {
    return this.companyService.getAllCompaniesForAdmin(page, limit);
  }

  async getCompanyById(companyId: string) {
    return this.companyService.getCompanyByIdForAdmin(companyId);
  }

  async updateCompanyStatus(
    companyId: string,
    updateDto: UpdateCompanyStatusDto,
    user: UserEntity,
  ) {
    return this.companyService.updateStatus(
      companyId,
      updateDto.status as any,
      user,
    );
  }

  async getDashboardStats() {
    // Use services from each bounded context instead of Prisma directly
    const [userStats, requestStats, professionalStats, companyStats] =
      await Promise.all([
        this.userService.getUserStats(),
        this.requestService.getRequestStats(),
        this.professionalService.getProfessionalStats(),
        this.companyService.getCompanyStats(),
      ]);

    return {
      users: userStats,
      requests: requestStats,
      professionals: professionalStats,
      companies: companyStats,
    };
  }
}
