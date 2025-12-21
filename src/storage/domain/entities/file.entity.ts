import { FileCategory } from '../value-objects/file-category.vo';

export class FileEntity {
  constructor(
    public readonly id: string,
    public readonly originalFilename: string,
    public readonly storedFilename: string,
    public readonly path: string,
    public readonly url: string,
    public readonly category: FileCategory,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly ownerId: string | null,
    public readonly requestId: string | null, // For request photos
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  getFullPath(): string {
    return this.path;
  }

  getPublicUrl(): string {
    return this.url;
  }

  belongsTo(userId: string): boolean {
    return this.ownerId === userId;
  }

  isPublic(): boolean {
    return (
      this.category === FileCategory.PROFILE_PICTURE ||
      this.category === FileCategory.PROJECT_IMAGE ||
      this.category === FileCategory.PROJECT_VIDEO
    );
  }
}
