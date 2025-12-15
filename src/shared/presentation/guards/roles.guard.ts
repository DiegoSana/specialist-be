import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../domain/value-objects/user-role.vo';
import { UserEntity } from '../../../user-management/domain/entities/user.entity';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserEntity = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Only ADMIN role is supported now
    const hasRole = requiredRoles.some((role) => role === UserRole.ADMIN && user.isAdminUser());

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
