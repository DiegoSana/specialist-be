import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { FileStorageService } from '../../application/services/file-storage.service';
import { UserEntity } from '../../../identity/domain/entities/user.entity';

@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(private readonly fileStorageService: FileStorageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let filePath = request.params.path || request.params.filePath;
    const user: UserEntity | undefined = request.user;

    if (!filePath) {
      throw new ForbiddenException('File path is required');
    }

    // The path comes from the URL as "requests/...", but we need to prepend "private/" for findByPath
    // Only if it doesn't already start with "private/"
    if (!filePath.startsWith('private/') && !filePath.startsWith('public/')) {
      // Determine if it's private or public based on the path
      if (filePath.startsWith('requests/')) {
        filePath = `private/${filePath}`;
      } else {
        // For other paths, assume private if not explicitly public
        filePath = `private/${filePath}`;
      }
    }

    const userId = user?.id || null;
    const isAdmin = user?.isAdminUser() || false;

    const canAccess = await this.fileStorageService.canAccessFile(filePath, userId, isAdmin);

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to access this file');
    }

    return true;
  }
}

