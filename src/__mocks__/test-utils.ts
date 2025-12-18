/**
 * Test Utilities and Factories
 * Common helpers for creating test data
 */
import { UserStatus, AuthProvider, ProfessionalStatus, RequestStatus } from '@prisma/client';
import { UserEntity } from '../identity/domain/entities/user.entity';
import { ProfessionalEntity, TradeInfo } from '../profiles/domain/entities/professional.entity';
import { RequestEntity } from '../requests/domain/entities/request.entity';

// Factory for creating test users
export const createMockUser = (overrides: Partial<{
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
  googleId: string | null;
  facebookId: string | null;
  authProvider: AuthProvider;
}> = {}): UserEntity => {
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
    googleId: null,
    facebookId: null,
    authProvider: AuthProvider.LOCAL,
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
    defaults.googleId,
    defaults.facebookId,
    defaults.authProvider,
  );
};

// Factory for creating test professionals
export const createMockProfessional = (overrides: Partial<{
  id: string;
  userId: string;
  trades: TradeInfo[];
  description: string | null;
  experienceYears: number | null;
  status: ProfessionalStatus;
  zone: string | null;
  city: string;
  address: string | null;
  whatsapp: string | null;
  website: string | null;
  averageRating: number;
  totalReviews: number;
  profileImage: string | null;
  gallery: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}): ProfessionalEntity => {
  const defaults = {
    id: 'professional-123',
    userId: 'user-123',
    trades: [{ id: 'trade-1', name: 'Electricista', category: 'Hogar', description: null, isPrimary: true }],
    description: 'Experienced professional',
    experienceYears: 5,
    status: ProfessionalStatus.VERIFIED,
    zone: 'Centro',
    city: 'Bariloche',
    address: 'Main Street 123',
    whatsapp: '+5491155551234',
    website: 'https://professional.com',
    averageRating: 4.5,
    totalReviews: 10,
    profileImage: null,
    gallery: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return new ProfessionalEntity(
    defaults.id,
    defaults.userId,
    defaults.trades,
    defaults.description,
    defaults.experienceYears,
    defaults.status,
    defaults.zone,
    defaults.city,
    defaults.address,
    defaults.whatsapp,
    defaults.website,
    defaults.averageRating,
    defaults.totalReviews,
    defaults.profileImage,
    defaults.gallery,
    defaults.active,
    defaults.createdAt,
    defaults.updatedAt,
  );
};

// Factory for creating test requests
export const createMockRequest = (overrides: Partial<{
  id: string;
  clientId: string;
  professionalId: string | null;
  tradeId: string | null;
  isPublic: boolean;
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
}> = {}): RequestEntity => {
  const defaults = {
    id: 'request-123',
    clientId: 'user-123',
    professionalId: 'professional-123',
    tradeId: 'trade-123',
    isPublic: false,
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
    defaults.professionalId,
    defaults.tradeId,
    defaults.isPublic,
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
export const TEST_PASSWORD_HASH = '$2a$10$K4/rGrqVj7QJHrvHSMK7/.yGVFJRxRmvvV.WBZ4Tz0l7I0kzM0pNm';

// Mock JWT payload
export const createMockJwtPayload = (userId: string, isAdmin = false) => ({
  sub: userId,
  email: 'test@example.com',
  isAdmin,
  hasClientProfile: true,
  hasProfessionalProfile: false,
});
