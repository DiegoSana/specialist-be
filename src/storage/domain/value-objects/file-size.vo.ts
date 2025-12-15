export class FileSizeVO {
  constructor(private readonly sizeInBytes: number, private readonly maxSize: number) {
    if (sizeInBytes <= 0) {
      throw new Error('File size must be greater than 0');
    }
    if (sizeInBytes > maxSize) {
      throw new Error(
        `File size ${this.formatSize(sizeInBytes)} exceeds maximum allowed size ${this.formatSize(maxSize)}`,
      );
    }
  }

  getValue(): number {
    return this.sizeInBytes;
  }

  getMaxSize(): number {
    return this.maxSize;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  toString(): string {
    return this.formatSize(this.sizeInBytes);
  }
}

