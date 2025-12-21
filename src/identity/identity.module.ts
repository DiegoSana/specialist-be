import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain
import { USER_REPOSITORY } from './domain/repositories/user.repository';

// Application
import { AuthenticationService } from './application/services/authentication.service';

// Infrastructure
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { FacebookStrategy } from './infrastructure/strategies/facebook.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';

// Presentation
import { AuthController } from './presentation/auth.controller';
import { UsersController } from './presentation/users.controller';

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
  controllers: [AuthController, UsersController],
  providers: [
    AuthenticationService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    JwtAuthGuard,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [AuthenticationService, JwtStrategy, JwtAuthGuard, USER_REPOSITORY],
})
export class IdentityModule {}
