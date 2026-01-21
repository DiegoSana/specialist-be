import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { UserEntity } from '../../../identity/domain/entities/user.entity';

/**
 * Response DTO for user profile endpoints.
 * Excludes sensitive fields like password, googleId, facebookId.
 */
export class UserProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  profilePictureUrl: string | null;

  @ApiProperty()
  isAdmin: boolean;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty()
  hasClientProfile: boolean;

  @ApiProperty()
  hasProfessionalProfile: boolean;

  @ApiProperty()
  hasCompanyProfile: boolean;

  @ApiProperty()
  phoneVerified: boolean;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /**
   * Convert domain entity to response DTO.
   * Excludes sensitive fields (password, OAuth IDs).
   */
  static fromEntity(user: UserEntity): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.phone = user.phone;
    dto.profilePictureUrl = user.profilePictureUrl;
    dto.isAdmin = user.isAdmin;
    dto.status = user.status;
    dto.hasClientProfile = user.hasClientProfile;
    dto.hasProfessionalProfile = user.hasProfessionalProfile;
    dto.hasCompanyProfile = user.hasCompanyProfile;
    dto.phoneVerified = user.phoneVerified;
    dto.emailVerified = user.emailVerified;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }

  /**
   * Convert multiple entities to DTOs.
   */
  static fromEntities(users: UserEntity[]): UserProfileResponseDto[] {
    return users.map((user) => UserProfileResponseDto.fromEntity(user));
  }
}
