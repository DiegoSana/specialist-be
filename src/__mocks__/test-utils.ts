/**
 * Test Utilities and Factories
 * Common helpers for creating test data
 */
import {
  UserStatus,
  AuthProvider,
  ProfessionalStatus,
  RequestStatus,
} from '@prisma/client';
import { UserEntity } from '../identity/domain/entities/user.entity';
import {
  ProfessionalEntity,
  TradeInfo,
} from '../profiles/domain/entities/professional.entity';
import { RequestEntity } from '../requests/domain/entities/request.entity';

// Factory for creating test users
export const createMockUser = (
  overrides: Partial<{
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
    hasClientProfile: boolean;
    hasProfessionalProfile: boolean;
    hasCompanyProfile: boolean;
    googleId: string | null;
    facebookId: string | null;
    authProvider: AuthProvider;
    phoneVerified: boolean;
    emailVerified: boolean;
  }> = {},
): UserEntity => {
  const defaults = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+5491155551234',
    profilePictureUrl: null,
    isAdmin: false,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    hasClientProfile: true,
    hasProfessionalProfile: false,
    hasCompanyProfile: false,
    googleId: null,
    facebookId: null,
    authProvider: AuthProvider.LOCAL,
    phoneVerified: false,
    emailVerified: false,
    ...overrides,
  };

  return new UserEntity(
    defaults.id,
    defaults.email,
    defaults.password,
    defaults.firstName,
    defaults.lastName,
    defaults.phone,
    defaults.profilePictureUrl,
    defaults.isAdmin,
    defaults.status,
    defaults.createdAt,
    defaults.updatedAt,
    defaults.hasClientProfile,
    defaults.hasProfessionalProfile,
    defaults.hasCompanyProfile,
    defaults.googleId,
    defaults.facebookId,
    defaults.authProvider,
    defaults.phoneVerified,
    defaults.emailVerified,
  );
};

// Factory for creating test professionals
export const createMockProfessional = (
  overrides: Partial<{
    id: string;
    userId: string;
    serviceProviderId: string;
    trades: TradeInfo[];
    description: string | null;
    experienceYears: number | null;
    status: ProfessionalStatus;
    zone: string | null;
    city: string;
    address: string | null;
    website: string | null;
    averageRating: number;
    totalReviews: number;
    profileImage: string | null;
    gallery: string[];
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): ProfessionalEntity => {
  const defaults = {
    id: 'professional-123',
    userId: 'user-123',
    serviceProviderId: 'service-provider-123',
    trades: [
      {
        id: 'trade-1',
        name: 'Electricista',
        category: 'Hogar',
        description: null,
        isPrimary: true,
      },
    ],
    description: 'Experienced professional',
    experienceYears: 5,
    status: ProfessionalStatus.VERIFIED,
    zone: 'Centro',
    city: 'Bariloche',
    address: 'Main Street 123',
    website: 'https://professional.com',
    profileImage: null,
    gallery: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return new ProfessionalEntity(
    defaults.id,
    defaults.userId,
    defaults.serviceProviderId,
    defaults.trades,
    defaults.description,
    defaults.experienceYears,
    defaults.status,
    defaults.zone,
    defaults.city,
    defaults.address,
    defaults.website,
    defaults.profileImage,
    defaults.gallery,
    defaults.createdAt,
    defaults.updatedAt,
  );
};

// Factory for creating test requests
export const createMockRequest = (
  overrides: Partial<{
    id: string;
    clientId: string;
    providerId: string | null;
    tradeId: string | null;
    isPublic: boolean;
    title: string;
    description: string;
    address: string | null;
    availability: string | null;
    photos: string[];
    status: RequestStatus;
    quoteAmount: number | null;
    quoteNotes: string | null;
    clientRating: number | null;
    clientRatingComment: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): RequestEntity => {
  const defaults = {
    id: 'request-123',
    clientId: 'user-123',
    providerId: 'service-provider-123',
    tradeId: 'trade-123',
    isPublic: false,
    title: 'Test Request Title',
    description: 'Test description',
    address: 'Test Address 123',
    availability: 'Monday to Friday',
    photos: [],
    status: RequestStatus.PENDING,
    quoteAmount: null,
    quoteNotes: null,
    clientRating: null,
    clientRatingComment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return new RequestEntity(
    defaults.id,
    defaults.clientId,
    defaults.providerId,
    defaults.tradeId,
    defaults.isPublic,
    defaults.title,
    defaults.description,
    defaults.address,
    defaults.availability,
    defaults.photos,
    defaults.status,
    defaults.quoteAmount,
    defaults.quoteNotes,
    defaults.clientRating,
    defaults.clientRatingComment,
    defaults.createdAt,
    defaults.updatedAt,
  );
};

// Helper for creating bcrypt hashed password (for test assertions)
export const TEST_PASSWORD = 'TestPassword123!';
export const TEST_PASSWORD_HASH =
  '$2a$10$K4/rGrqVj7QJHrvHSMK7/.yGVFJRxRmvvV.WBZ4Tz0l7I0kzM0pNm';

// Mock JWT payload
export const createMockJwtPayload = (userId: string, isAdmin = false) => ({
  sub: userId,
  email: 'test@example.com',
  isAdmin,
  hasClientProfile: true,
  hasProfessionalProfile: false,
});
