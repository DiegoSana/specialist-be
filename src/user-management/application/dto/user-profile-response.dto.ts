import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

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
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

