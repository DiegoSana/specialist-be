import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../shared/infrastructure/prisma/prisma.module';
import { UserManagementService } from './application/services/user-management.service';
import { AuthenticationService } from './application/services/authentication.service';
import { UserManagementController } from './presentation/user-management.controller';
import { AuthenticationController } from './presentation/authentication.controller';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { LocalStrategy } from './infrastructure/local.strategy';
import { GoogleStrategy } from './infrastructure/strategies/google.strategy';
import { FacebookStrategy } from './infrastructure/strategies/facebook.strategy';
import { UserRepository, USER_REPOSITORY } from './domain/repositories/user.repository';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { ClientRepository, CLIENT_REPOSITORY } from './domain/repositories/client.repository';
import { PrismaClientRepository } from './infrastructure/repositories/prisma-client.repository';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserManagementController, AuthenticationController],
  providers: [
    UserManagementService,
    AuthenticationService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: CLIENT_REPOSITORY,
      useClass: PrismaClientRepository,
    },
  ],
  exports: [UserManagementService, AuthenticationService, USER_REPOSITORY, CLIENT_REPOSITORY],
})
export class UserManagementModule {}
