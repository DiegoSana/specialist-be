export enum FileCategory {
  PROFILE_PICTURE = 'profile-picture',
  PROJECT_IMAGE = 'project-image',
  PROJECT_VIDEO = 'project-video',
  REQUEST_PHOTO = 'request-photo',
}

export enum FileAccessLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  OWNER_ONLY = 'owner-only',
  PARTICIPANTS = 'participants',
}

export class FileCategoryVO {
  constructor(private readonly category: FileCategory) {
    if (!Object.values(FileCategory).includes(category)) {
      throw new Error(`Invalid file category: ${category}`);
    }
  }

  getValue(): FileCategory {
    return this.category;
  }

  getAccessLevel(): FileAccessLevel {
    switch (this.category) {
      case FileCategory.PROFILE_PICTURE:
      case FileCategory.PROJECT_IMAGE:
      case FileCategory.PROJECT_VIDEO:
        return FileAccessLevel.PUBLIC;
      case FileCategory.REQUEST_PHOTO:
        return FileAccessLevel.PARTICIPANTS;
      default:
        return FileAccessLevel.AUTHENTICATED;
    }
  }

  getStoragePath(): string {
    switch (this.category) {
      case FileCategory.PROFILE_PICTURE:
        return 'public/profile-pictures';
      case FileCategory.PROJECT_IMAGE:
        return 'public/projects/images';
      case FileCategory.PROJECT_VIDEO:
        return 'public/projects/videos';
      case FileCategory.REQUEST_PHOTO:
        return 'private/requests';
      default:
        return 'private/other';
    }
  }

  isPublic(): boolean {
    return this.getAccessLevel() === FileAccessLevel.PUBLIC;
  }
}

