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
   * Best-effort lookup by phone number. `phone` has no unique constraint, so this
   * returns the first match; used only for non-critical context enrichment (e.g. the
   * support context linking an inbound WhatsApp conversation to a known user), never
   * for authentication.
   */
  findByPhone(phone: string): Promise<UserEntity | null>;

  /**
   * Opción A (colección de agregados): persiste el aggregate completo.
   * La implementación se encarga de create vs update.
   */
  save(user: UserEntity): Promise<UserEntity>;
}

// Token for dependency injection
export const USER_REPOSITORY = Symbol('UserRepository');
