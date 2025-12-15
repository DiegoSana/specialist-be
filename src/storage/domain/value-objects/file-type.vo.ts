export enum AllowedMimeType {
  // Images
  IMAGE_JPEG = 'image/jpeg',
  IMAGE_PNG = 'image/png',
  IMAGE_WEBP = 'image/webp',
  IMAGE_GIF = 'image/gif',
  
  // Videos
  VIDEO_MP4 = 'video/mp4',
  VIDEO_WEBM = 'video/webm',
  VIDEO_QUICKTIME = 'video/quicktime',
}

export class FileTypeVO {
  private static readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

  constructor(
    private readonly mimeType: string,
    private readonly category: string,
  ) {
    this.validate();
  }

  private validate(): void {
    const allowedTypes = this.getAllowedTypesForCategory();
    if (!allowedTypes.includes(this.mimeType as AllowedMimeType)) {
      throw new Error(
        `Mime type ${this.mimeType} is not allowed for category ${this.category}`,
      );
    }
  }

  private getAllowedTypesForCategory(): AllowedMimeType[] {
    switch (this.category) {
      case 'profile-picture':
      case 'project-image':
      case 'request-photo':
        return [
          AllowedMimeType.IMAGE_JPEG,
          AllowedMimeType.IMAGE_PNG,
          AllowedMimeType.IMAGE_WEBP,
          AllowedMimeType.IMAGE_GIF,
        ];
      case 'project-video':
        return [
          AllowedMimeType.VIDEO_MP4,
          AllowedMimeType.VIDEO_WEBM,
          AllowedMimeType.VIDEO_QUICKTIME,
        ];
      default:
        return [];
    }
  }

  getMimeType(): string {
    return this.mimeType;
  }

  getMaxSize(): number {
    if (this.isImage()) {
      return FileTypeVO.MAX_IMAGE_SIZE;
    }
    if (this.isVideo()) {
      return FileTypeVO.MAX_VIDEO_SIZE;
    }
    return 0;
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }

  isVideo(): boolean {
    return this.mimeType.startsWith('video/');
  }

  getExtension(): string {
    const mimeToExt: Record<string, string> = {
      [AllowedMimeType.IMAGE_JPEG]: 'jpg',
      [AllowedMimeType.IMAGE_PNG]: 'png',
      [AllowedMimeType.IMAGE_WEBP]: 'webp',
      [AllowedMimeType.IMAGE_GIF]: 'gif',
      [AllowedMimeType.VIDEO_MP4]: 'mp4',
      [AllowedMimeType.VIDEO_WEBM]: 'webm',
      [AllowedMimeType.VIDEO_QUICKTIME]: 'mov',
    };
    return mimeToExt[this.mimeType] || 'bin';
  }
}

