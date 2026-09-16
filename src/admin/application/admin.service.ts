import { Injectable } from '@nestjs/common';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CompanyService } from '../../profiles/application/services/company.service';
import { RequestService } from '../../requests/application/services/request.service';
import { RequestInterestService } from '../../requests/application/services/request-interest.service';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { RequestStatus } from '@prisma/client';
import { AdminRequestDetailResponseDto } from '../presentation/dto/admin-request-detail-response.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
    private readonly requestService: RequestService,
    private readonly requestInterestService: RequestInterestService,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10, search?: string) {
    return this.userService.getAllUsersForAdmin(page, limit, search);
  }

  async getUserById(userId: string, actingUser: UserEntity) {
    return this.userService.findByIdForUser(userId, actingUser);
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
  ) {
    return this.requestService.getAllRequestsForAdmin(page, limit, status);
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
