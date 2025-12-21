import { UserEntity } from '../entities/user.entity';
import { UserStatus, AuthProvider } from '@prisma/client';

export interface UserRepository {
  findByEmail(
    email: string,
    includeProfiles?: boolean,
  ): Promise<UserEntity | null>;
  findById(id: string, includeProfiles?: boolean): Promise<UserEntity | null>;
  findByGoogleId(googleId: string): Promise<UserEntity | null>;
  findByFacebookId(facebookId: string): Promise<UserEntity | null>;
  create(user: {
    email: string;
    password: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    profilePictureUrl?: string | null;
    isAdmin?: boolean;
    status: UserStatus;
    googleId?: string;
    facebookId?: string;
    authProvider?: AuthProvider;
  }): Promise<UserEntity>;
  update(id: string, data: Partial<UserEntity>): Promise<UserEntity>;
}

// Token for dependency injection
export const USER_REPOSITORY = Symbol('UserRepository');
