import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    hasClientProfile: boolean;
    hasProfessionalProfile: boolean;
    isAdmin: boolean;
  };
}

