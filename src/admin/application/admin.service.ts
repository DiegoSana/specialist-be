import { Injectable } from '@nestjs/common';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateProfessionalStatusDto } from './dto/update-professional-status.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
// Cross-context dependencies - using Services instead of Repositories (DDD)
import { UserService } from '../../identity/application/services/user.service';
import { ProfessionalService } from '../../profiles/application/services/professional.service';
import { CompanyService } from '../../profiles/application/services/company.service';
import { RequestService } from '../../requests/application/services/request.service';
import { UserEntity } from '../../identity/domain/entities/user.entity';
import { RequestStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly professionalService: ProfessionalService,
    private readonly companyService: CompanyService,
    private readonly requestService: RequestService,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10) {
    return this.userService.getAllUsersForAdmin(page, limit);
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

  async getAllRequests(page: number = 1, limit: number = 10, status?: RequestStatus) {
    return this.requestService.getAllRequestsForAdmin(page, limit, status);
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
