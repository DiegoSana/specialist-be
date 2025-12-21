import { UserEntity } from '../entities/user.entity';

export interface UserRepository {
  findByEmail(
    email: string,
    includeProfiles?: boolean,
  ): Promise<UserEntity | null>;
  findById(id: string, includeProfiles?: boolean): Promise<UserEntity | null>;
  findByGoogleId(googleId: string): Promise<UserEntity | null>;
  findByFacebookId(facebookId: string): Promise<UserEntity | null>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(user: UserEntity): Promise<UserEntity>;
}

// Token for dependency injection
export const USER_REPOSITORY = Symbol('UserRepository');
