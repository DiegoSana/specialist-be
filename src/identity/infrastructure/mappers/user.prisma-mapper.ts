import { AuthProvider, UserStatus } from '@prisma/client';
import { UserEntity } from '../../domain/entities/user.entity';

/**
 * Mapper bidireccional entre el modelo de persistencia (Prisma)
 * y el modelo de dominio (UserEntity).
 *
 * Nota: algunos repositorios incluyen relaciones (client/professional)
 * solo para enriquecer respuestas de API; aquí lo reflejamos como flags.
 */
export class PrismaUserMapper {
  static toDomain(user: {
    id: string;
    email: string;
    password: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    profilePictureUrl: string | null;
    isAdmin: boolean;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    client?: unknown | null;
    professional?: unknown | null;
    googleId?: string | null;
    facebookId?: string | null;
    authProvider?: AuthProvider | null;
  }): UserEntity {
    return new UserEntity(
      user.id,
      user.email,
      user.password,
      user.firstName,
      user.lastName,
      user.phone,
      user.profilePictureUrl || null,
      user.isAdmin || false,
      user.status as UserStatus,
      user.createdAt,
      user.updatedAt,
      !!user.client,
      !!user.professional,
      user.googleId || null,
      user.facebookId || null,
      user.authProvider || AuthProvider.LOCAL,
    );
  }

  static toPersistenceCreate(input: {
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
  }): {
    email: string;
    password: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    profilePictureUrl: string | null;
    isAdmin: boolean;
    status: UserStatus;
    googleId: string | null;
    facebookId: string | null;
    authProvider: AuthProvider;
  } {
    return {
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      profilePictureUrl: input.profilePictureUrl ?? null,
      isAdmin: input.isAdmin ?? false,
      status: input.status,
      googleId: input.googleId ?? null,
      facebookId: input.facebookId ?? null,
      authProvider: input.authProvider ?? AuthProvider.LOCAL,
    };
  }

  /**
   * Prisma update data para User.
   * Sólo incluye campos presentes (undefined = no tocar).
   */
  static toPersistenceUpdate(
    partial: Partial<UserEntity> & { googleId?: string | null; facebookId?: string | null; authProvider?: AuthProvider | null },
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};

    if (partial.email !== undefined) updateData.email = partial.email;
    if (partial.password !== undefined) updateData.password = partial.password;
    if (partial.firstName !== undefined) updateData.firstName = partial.firstName;
    if (partial.lastName !== undefined) updateData.lastName = partial.lastName;
    if (partial.phone !== undefined) updateData.phone = partial.phone;
    if (partial.profilePictureUrl !== undefined) updateData.profilePictureUrl = partial.profilePictureUrl;
    if (partial.isAdmin !== undefined) updateData.isAdmin = partial.isAdmin;
    if (partial.status !== undefined) updateData.status = partial.status;
    if (partial.googleId !== undefined) updateData.googleId = partial.googleId;
    if (partial.facebookId !== undefined) updateData.facebookId = partial.facebookId;
    if (partial.authProvider !== undefined) updateData.authProvider = partial.authProvider;

    return updateData;
  }
}

