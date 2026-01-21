import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import {
  VERIFICATION_SERVICE,
} from './domain/ports/verification.service';

// Application
import { AuthenticationService } from './application/services/authentication.service';
import { UserService } from './application/services/user.service';
import { VerificationService } from './application/services/verification.service';

// Infrastructure
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { FacebookStrategy } from './infrastructure/strategies/facebook.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { TwilioVerifyService } from './infrastructure/verification/twilio-verify.service';

// Presentation
import { AuthController } from './presentation/auth.controller';
import { UsersController } from './presentation/users.controller';
import { VerificationController } from './presentation/verification.controller';

// Shared
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';

// Cross-context dependency - will be properly injected via forwardRef
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ProfilesModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AuthController,
    UsersController,
    VerificationController,
  ],
  providers: [
    AuthenticationService,
    UserService,
    VerificationService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    JwtAuthGuard,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: VERIFICATION_SERVICE,
      useClass: TwilioVerifyService,
    },
  ],
  exports: [
    AuthenticationService,
    UserService,
    JwtStrategy,
    JwtAuthGuard,
    // Note: Repositories are NOT exported - use Services instead (DDD)
  ],
})
export class IdentityModule {}
