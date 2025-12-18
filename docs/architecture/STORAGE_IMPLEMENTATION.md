# Storage Module - Implementation Documentation

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Module Structure](#module-structure)
4. [File Categories](#file-categories)
5. [Permission System](#permission-system)
6. [Value Objects](#value-objects)
7. [File Repository](#file-repository)
8. [Storage Service](#storage-service)
9. [API Endpoints](#api-endpoints)
10. [Configuration](#configuration)
11. [Usage and Examples](#usage-and-examples)
12. [Extensibility](#extensibility)
13. [Migration to S3/Azure](#migration-to-s3azure)

---

## Introduction

The Storage module provides a decoupled and extensible solution for handling multimedia files in the application. It is designed following **Domain-Driven Design (DDD)** principles and the **Repository** pattern, allowing easy switching of storage providers without affecting business code.

### Main Features

- ✅ **Decoupled**: Abstract interface allowing provider changes
- ✅ **Extensible**: Easy migration to S3, Azure Blob Storage, Google Cloud Storage, etc.
- ✅ **Validation**: MIME type, size, and permission validation
- ✅ **Security**: Granular permission system (public, private, owner, admin)
- ✅ **Organized**: Clear folder structure by category

---

## Architecture

The module follows the project's DDD architecture, divided into layers:

```
storage/
├── domain/              # Domain logic
│   ├── entities/        # Business entities
│   ├── repositories/    # Interfaces (contracts)
│   └── value-objects/   # Value objects
├── application/         # Application logic
│   ├── services/        # Business services
│   └── dto/             # Data Transfer Objects
├── infrastructure/      # Technical implementations
│   └── repositories/    # Concrete implementations
└── presentation/        # Presentation layer
    ├── controllers/     # REST endpoints
    └── guards/          # Security guards
```

### Data Flow

```
Controller → Service → Repository → FileSystem/S3/etc.
     ↓         ↓           ↓
   Guard    Validation   Storage
```

---

## Module Structure

### Domain Layer

#### `FileEntity`
Domain entity representing a file with all its metadata:

```typescript
class FileEntity {
  id: string;
  originalFilename: string;
  storedFilename: string;
  path: string;
  url: string;
  category: FileCategory;
  mimeType: string;
  size: number;
  ownerId: string | null;
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `FileStorageRepository` (Interface)
Contract defining storage operations:

```typescript
interface FileStorageRepository {
  upload(file: Buffer, metadata: {...}): Promise<FileEntity>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  findByPath(filePath: string): Promise<FileEntity | null>;
  findById(id: string): Promise<FileEntity | null>;
}
```

### Application Layer

#### `FileStorageService`
Service containing business logic:

- File validation
- Permission control
- Ownership management
- Integration with other services (RequestRepository)

### Infrastructure Layer

#### `LocalFileStorageRepository`
Current implementation storing files on the local filesystem.

### Presentation Layer

#### `FileStorageController`
REST controller exposing API endpoints.

#### `FileAccessGuard`
Guard validating file access permissions.

---

## File Categories

The system defines 4 main categories:

### 1. `PROFILE_PICTURE`
- **Access**: Public
- **Location**: `public/profile-pictures/{userId}/{filename}`
- **Allowed types**: JPEG, PNG, WebP, GIF
- **Max size**: 10MB
- **Usage**: User profile photos

### 2. `PROJECT_IMAGE`
- **Access**: Public
- **Location**: `public/projects/images/{userId}/{filename}`
- **Allowed types**: JPEG, PNG, WebP, GIF
- **Max size**: 10MB
- **Usage**: Professional project images

### 3. `PROJECT_VIDEO`
- **Access**: Public
- **Location**: `public/projects/videos/{userId}/{filename}`
- **Allowed types**: MP4, WebM, QuickTime
- **Max size**: 100MB
- **Usage**: Professional project videos

### 4. `REQUEST_PHOTO`
- **Access**: Private (participants only)
- **Location**: `private/requests/{requestId}/{filename}`
- **Allowed types**: JPEG, PNG, WebP, GIF
- **Max size**: 10MB
- **Usage**: Photos attached to service requests

---

## Permission System

### Access Levels

| Level | Description | Example |
|-------|-------------|---------|
| **PUBLIC** | Accessible without authentication | Profile pictures, project images |
| **AUTHENTICATED** | Requires login | (Reserved for future categories) |
| **OWNER_ONLY** | Owner only | Deleting own files |
| **PARTICIPANTS** | Owner + participants | Request photos (client + professional) |

### Access Rules

1. **Public Files**:
   - Anyone can read
   - Only owner can delete
   - Only owner can upload

2. **Private Files** (Request Photos):
   - Only the client who created the request can upload
   - Only the client and assigned professional can read
   - Only owner can delete

3. **Administrators**:
   - Can access **all** files
   - Can delete any file

### Permission Validation

The `FileAccessGuard` validates permissions before allowing access:

```typescript
// Validation flow
1. Extract filePath from request
2. Get user (can be null if not authenticated)
3. Check if admin → Allow access
4. Check if public → Allow access
5. Check ownership → Allow access
6. Check participation (for requests) → Allow access
7. Deny access
```

---

## Value Objects

### `FileCategoryVO`
Encapsulates logic related to file categories:

```typescript
class FileCategoryVO {
  getValue(): FileCategory;
  getAccessLevel(): FileAccessLevel;
  getStoragePath(): string;
  isPublic(): boolean;
}
```

### `FileTypeVO`
Validates MIME types and determines extensions:

```typescript
class FileTypeVO {
  constructor(mimeType: string, category: string);
  getMimeType(): string;
  getMaxSize(): number;
  isImage(): boolean;
  isVideo(): boolean;
  getExtension(): string;
}
```

**Allowed MIME types**:
- **Images**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **Videos**: `video/mp4`, `video/webm`, `video/quicktime`

### `FileSizeVO`
Validates and formats file sizes:

```typescript
class FileSizeVO {
  constructor(sizeInBytes: number, maxSize: number);
  getValue(): number;
  formatSize(bytes: number): string;
}
```

**Limits**:
- Images: 10MB
- Videos: 100MB

---

## File Repository

### `FileStorageRepository` Interface

Defines the contract all implementations must fulfill:

```typescript
interface FileStorageRepository {
  upload(file: Buffer, metadata: {...}): Promise<FileEntity>;
  delete(filePath: string): Promise<void>;
  getUrl(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  findByPath(filePath: string): Promise<FileEntity | null>;
  findById(id: string): Promise<FileEntity | null>;
}
```

### Local Implementation

`LocalFileStorageRepository` stores files on the filesystem:

**Storage structure**:
```
uploads/
├── public/
│   ├── profile-pictures/
│   │   └── {userId}/
│   │       └── {uuid}.{ext}
│   └── projects/
│       ├── images/
│       │   └── {userId}/
│       │       └── {uuid}.{ext}
│       └── videos/
│           └── {userId}/
│               └── {uuid}.{ext}
└── private/
    └── requests/
        └── {requestId}/
            └── {uuid}.{ext}
```

**Features**:
- Generates unique names using UUID
- Creates directories automatically
- Builds public/private URLs

---

## Storage Service

### `FileStorageService`

Contains business logic for file handling:

#### Main Methods

##### `uploadFile(file, uploadDto, userId)`
Uploads a file and validates:
- File existence
- Allowed MIME type
- Size within limit
- Ownership (for request photos, validates user is the client)

##### `getFile(filePath)`
Gets file metadata.

##### `deleteFile(filePath, userId, isAdmin)`
Deletes a file validating:
- File existence
- Permissions (owner or admin)

##### `canAccessFile(filePath, userId, isAdmin)`
Validates if a user can access a file:
- Admin → Always allowed
- Public → Always allowed
- Owner → Allowed
- Participant (for requests) → Allowed if client or professional

---

## API Endpoints

### 1. Upload File

```http
POST /api/storage/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Body**:
- `file`: File (binary)
- `category`: `profile-picture` | `project-image` | `project-video` | `request-photo`
- `requestId`: UUID (optional, only for `request-photo`)

**Response** (201):
```json
{
  "id": "uuid",
  "originalFilename": "photo.jpg",
  "storedFilename": "abc123.jpg",
  "path": "public/profile-pictures/user123/abc123.jpg",
  "url": "http://localhost:5000/api/storage/public/profile-pictures/user123/abc123.jpg",
  "category": "profile-picture",
  "mimeType": "image/jpeg",
  "size": 1024000,
  "ownerId": "user123",
  "requestId": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### 2. Get Public File

```http
GET /api/storage/public/{path}
```

**Example**:
```
GET /api/storage/public/profile-pictures/user123/abc123.jpg
```

**Response**: Binary file (image/video)

### 3. Get Private File

```http
GET /api/storage/private/{path}
Authorization: Bearer {token}
```

**Example**:
```
GET /api/storage/private/requests/req456/xyz789.jpg
```

**Response**: Binary file (if authorized)

### 4. Delete File

```http
DELETE /api/storage/{path}
Authorization: Bearer {token}
```

**Example**:
```
DELETE /api/storage/public/profile-pictures/user123/abc123.jpg
```

**Response**: 204 No Content

---

## Configuration

### Environment Variables

Add to `.env` file:

```env
# Path for local file storage
STORAGE_LOCAL_PATH=./uploads

# Base URL for generating file URLs
STORAGE_BASE_URL=http://localhost:5000/api/storage

# Storage provider (future)
STORAGE_PROVIDER=local
```

### Module Configuration

The module is automatically registered in `app.module.ts`:

```typescript
@Module({
  imports: [
    // ...
    StorageModule,
  ],
})
export class AppModule {}
```

---

## Usage and Examples

### Example 1: Upload Profile Picture

```typescript
// Frontend (React/Next.js)
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('category', 'profile-picture');

const response = await fetch('/api/storage/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const fileEntity = await response.json();
console.log('File URL:', fileEntity.url);
```

### Example 2: Upload Request Photo

```typescript
const formData = new FormData();
formData.append('file', photoFile);
formData.append('category', 'request-photo');
formData.append('requestId', requestId);

const response = await fetch('/api/storage/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});
```

### Example 3: Get Public File

```typescript
// No authentication required
const imageUrl = 'http://localhost:5000/api/storage/public/profile-pictures/user123/abc123.jpg';
<img src={imageUrl} alt="Profile" />
```

### Example 4: Get Private File

```typescript
// Requires authentication and permissions
const imageUrl = 'http://localhost:5000/api/storage/private/requests/req456/xyz789.jpg';
// Use with token in headers or as query param
```

---

## Extensibility

### Adding a New Category

1. **Add to enum**:
```typescript
// domain/value-objects/file-category.vo.ts
export enum FileCategory {
  // ... existing
  NEW_CATEGORY = 'new-category',
}
```

2. **Define access and path**:
```typescript
getAccessLevel(): FileAccessLevel {
  switch (this.category) {
    // ...
    case FileCategory.NEW_CATEGORY:
      return FileAccessLevel.AUTHENTICATED;
  }
}

getStoragePath(): string {
  switch (this.category) {
    // ...
    case FileCategory.NEW_CATEGORY:
      return 'private/new-category';
  }
}
```

3. **Update validations** in `FileTypeVO` if necessary.

### Adding a New MIME Type

1. **Add to enum**:
```typescript
// domain/value-objects/file-type.vo.ts
export enum AllowedMimeType {
  // ... existing
  IMAGE_SVG = 'image/svg+xml',
}
```

2. **Update validations**:
```typescript
private getAllowedTypesForCategory(): AllowedMimeType[] {
  switch (this.category) {
    case 'profile-picture':
      return [
        // ... existing
        AllowedMimeType.IMAGE_SVG,
      ];
  }
}
```

---

## Migration to S3/Azure

### Step 1: Create New Implementation

Create `S3FileStorageRepository`:

```typescript
// infrastructure/repositories/s3-file-storage.repository.ts
@Injectable()
export class S3FileStorageRepository implements FileStorageRepository {
  constructor(
    private readonly s3Client: S3Client,
    private readonly bucketName: string,
  ) {}

  async upload(file: Buffer, metadata: {...}): Promise<FileEntity> {
    const key = this.generateKey(metadata);
    
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: metadata.mimeType,
    });

    const url = this.getPublicUrl(key);
    // ... create FileEntity
  }

  async delete(filePath: string): Promise<void> {
    await this.s3Client.deleteObject({
      Bucket: this.bucketName,
      Key: filePath,
    });
  }

  // ... implement other methods
}
```

### Step 2: Update Module

```typescript
// storage.module.ts
const storageProvider = configService.get('STORAGE_PROVIDER', 'local');

const repositoryProvider = {
  provide: FILE_STORAGE_REPOSITORY,
  useClass: storageProvider === 's3' 
    ? S3FileStorageRepository 
    : LocalFileStorageRepository,
};
```

### Step 3: Configuration

```env
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Design Benefits

- ✅ **No changes to business code**: Service and controller remain unchanged
- ✅ **Interchangeable**: Only change repository implementation
- ✅ **Testable**: Easy to mock in tests
- ✅ **Multiple providers**: Can have several active implementations

---

## Future Considerations

### 1. Database for Metadata

Currently, metadata is extracted from the filesystem. For production, consider:

- Create `files` table in Prisma
- Store metadata on upload
- Query from DB instead of filesystem

### 2. Signed URLs

For private files, implement URLs with expiration:

```typescript
GET /api/storage/generate-signed-url/:path
→ { url: "https://...?token=...&expires=..." }
```

### 3. Image Optimization

- Automatic resizing
- Thumbnail generation
- Format conversion

### 4. CDN Integration

- Configure CDN for public files
- Cache invalidation
- Geographic distribution

---

## Testing

### Unit Test Example

```typescript
describe('FileStorageService', () => {
  let service: FileStorageService;
  let repository: FileStorageRepository;

  beforeEach(() => {
    repository = {
      upload: jest.fn(),
      delete: jest.fn(),
      // ... mock methods
    };
    service = new FileStorageService(repository, requestRepository);
  });

  it('should upload file with valid metadata', async () => {
    const file = { buffer: Buffer.from('test'), mimetype: 'image/jpeg', ... };
    const result = await service.uploadFile(file, { category: 'profile-picture' }, 'user123');
    
    expect(repository.upload).toHaveBeenCalled();
    expect(result.ownerId).toBe('user123');
  });
});
```

---

## Troubleshooting

### Error: "File not found"
- Verify file exists at specified path
- Check filesystem permissions
- Verify `STORAGE_LOCAL_PATH` is configured correctly

### Error: "Mime type not allowed"
- Verify MIME type is in allowed list for the category
- Verify file is not corrupted

### Error: "File size exceeds maximum"
- Check limits: 10MB for images, 100MB for videos
- Compress files before uploading if necessary

### Error: "You do not have permission"
- Verify user is authenticated (for private files)
- Check ownership or request participation
- Check if user is admin

---

## Conclusion

The Storage module provides a robust, extensible, and secure solution for handling multimedia files. Its decoupled design allows easy migration to cloud providers without affecting business code, while the granular permission system ensures only authorized users can access files.

For more information or support, consult the project documentation or contact the development team.
