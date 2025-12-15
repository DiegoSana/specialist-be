import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserEntity } from '../../../user-management/domain/entities/user.entity';

@Injectable()
export class ProfessionalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.isProfessional()) {
      throw new ForbiddenException('Professional access required');
    }

    return true;
  }
}
