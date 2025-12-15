# Storage Module - Implementation Documentation

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Estructura del Módulo](#estructura-del-módulo)
4. [Categorías de Archivos](#categorías-de-archivos)
5. [Sistema de Permisos](#sistema-de-permisos)
6. [Value Objects](#value-objects)
7. [Repositorio de Archivos](#repositorio-de-archivos)
8. [Servicio de Storage](#servicio-de-storage)
9. [Endpoints API](#endpoints-api)
10. [Configuración](#configuración)
11. [Uso y Ejemplos](#uso-y-ejemplos)
12. [Extensibilidad](#extensibilidad)
13. [Migración a S3/Azure](#migración-a-s3azure)

---

## Introducción

El módulo de Storage proporciona una solución desacoplada y extensible para el manejo de archivos multimedia en la aplicación. Está diseñado siguiendo los principios de **Domain-Driven Design (DDD)** y el patrón **Repository**, permitiendo cambiar fácilmente el proveedor de almacenamiento sin afectar el código de negocio.

### Características Principales

- ✅ **Desacoplado**: Interfaz abstracta que permite cambiar el proveedor
- ✅ **Extensible**: Fácil migración a S3, Azure Blob Storage, Google Cloud Storage, etc.
- ✅ **Validación**: Validación de tipos MIME, tamaños y permisos
- ✅ **Seguridad**: Sistema de permisos granular (público, privado, owner, admin)
- ✅ **Organizado**: Estructura de carpetas clara por categoría

---

## Arquitectura

El módulo sigue la arquitectura DDD del proyecto, dividido en capas:

```
storage/
├── domain/              # Lógica de dominio
│   ├── entities/        # Entidades de negocio
│   ├── repositories/    # Interfaces (contratos)
│   └── value-objects/  # Objetos de valor
├── application/         # Lógica de aplicación
│   ├── services/       # Servicios de negocio
│   └── dto/            # Data Transfer Objects
├── infrastructure/      # Implementaciones técnicas
│   └── repositories/   # Implementaciones concretas
└── presentation/        # Capa de presentación
    ├── controllers/    # Endpoints REST
    └── guards/         # Guards de seguridad
```

### Flujo de Datos

```
Controller → Service → Repository → FileSystem/S3/etc.
     ↓         ↓           ↓
   Guard    Validation   Storage
```

---

## Estructura del Módulo

### Domain Layer

#### `FileEntity`
Entidad de dominio que representa un archivo con todos sus metadatos:

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

#### `FileStorageRepository` (Interfaz)
Contrato que define las operaciones de almacenamiento:

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
Servicio que contiene la lógica de negocio:

- Validación de archivos
- Control de permisos
- Gestión de ownership
- Integración con otros servicios (RequestRepository)

### Infrastructure Layer

#### `LocalFileStorageRepository`
Implementación actual que almacena archivos en el sistema de archivos local.

### Presentation Layer

#### `FileStorageController`
Controlador REST que expone los endpoints de la API.

#### `FileAccessGuard`
Guard que valida los permisos de acceso a archivos.

---

## Categorías de Archivos

El sistema define 4 categorías principales:

### 1. `PROFILE_PICTURE`
- **Acceso**: Público
- **Ubicación**: `public/profile-pictures/{userId}/{filename}`
- **Tipos permitidos**: JPEG, PNG, WebP, GIF
- **Tamaño máximo**: 10MB
- **Uso**: Fotos de perfil de usuarios

### 2. `PROJECT_IMAGE`
- **Acceso**: Público
- **Ubicación**: `public/projects/images/{userId}/{filename}`
- **Tipos permitidos**: JPEG, PNG, WebP, GIF
- **Tamaño máximo**: 10MB
- **Uso**: Imágenes de proyectos de profesionales

### 3. `PROJECT_VIDEO`
- **Acceso**: Público
- **Ubicación**: `public/projects/videos/{userId}/{filename}`
- **Tipos permitidos**: MP4, WebM, QuickTime
- **Tamaño máximo**: 100MB
- **Uso**: Videos de proyectos de profesionales

### 4. `REQUEST_PHOTO`
- **Acceso**: Privado (solo participantes)
- **Ubicación**: `private/requests/{requestId}/{filename}`
- **Tipos permitidos**: JPEG, PNG, WebP, GIF
- **Tamaño máximo**: 10MB
- **Uso**: Fotos adjuntas a solicitudes de trabajo

---

## Sistema de Permisos

### Niveles de Acceso

| Nivel | Descripción | Ejemplo |
|-------|-------------|---------|
| **PUBLIC** | Accesible sin autenticación | Profile pictures, project images |
| **AUTHENTICATED** | Requiere login | (Reservado para futuras categorías) |
| **OWNER_ONLY** | Solo el dueño | Eliminación de archivos propios |
| **PARTICIPANTS** | Dueño + participantes | Request photos (cliente + profesional) |

### Reglas de Acceso

1. **Archivos Públicos**:
   - Cualquiera puede leer
   - Solo el owner puede eliminar
   - Solo el owner puede subir

2. **Archivos Privados** (Request Photos):
   - Solo el cliente que creó la solicitud puede subir
   - Solo el cliente y el profesional asignado pueden leer
   - Solo el owner puede eliminar

3. **Administradores**:
   - Pueden acceder a **todos** los archivos
   - Pueden eliminar cualquier archivo

### Validación de Permisos

El `FileAccessGuard` valida los permisos antes de permitir el acceso:

```typescript
// Flujo de validación
1. Extraer filePath de la request
2. Obtener usuario (puede ser null si no está autenticado)
3. Verificar si es admin → Permitir acceso
4. Verificar si es público → Permitir acceso
5. Verificar ownership → Permitir acceso
6. Verificar participación (para requests) → Permitir acceso
7. Denegar acceso
```

---

## Value Objects

### `FileCategoryVO`
Encapsula la lógica relacionada con las categorías de archivos:

```typescript
class FileCategoryVO {
  getValue(): FileCategory;
  getAccessLevel(): FileAccessLevel;
  getStoragePath(): string;
  isPublic(): boolean;
}
```

### `FileTypeVO`
Valida tipos MIME y determina extensiones:

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

**Tipos MIME permitidos**:
- **Imágenes**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **Videos**: `video/mp4`, `video/webm`, `video/quicktime`

### `FileSizeVO`
Valida y formatea tamaños de archivo:

```typescript
class FileSizeVO {
  constructor(sizeInBytes: number, maxSize: number);
  getValue(): number;
  formatSize(bytes: number): string;
}
```

**Límites**:
- Imágenes: 10MB
- Videos: 100MB

---

## Repositorio de Archivos

### Interfaz `FileStorageRepository`

Define el contrato que todas las implementaciones deben cumplir:

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

### Implementación Local

`LocalFileStorageRepository` almacena archivos en el sistema de archivos:

**Estructura de almacenamiento**:
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

**Características**:
- Genera nombres únicos usando UUID
- Crea directorios automáticamente
- Construye URLs públicas/privadas

---

## Servicio de Storage

### `FileStorageService`

Contiene la lógica de negocio para el manejo de archivos:

#### Métodos Principales

##### `uploadFile(file, uploadDto, userId)`
Sube un archivo y valida:
- Existencia del archivo
- Tipo MIME permitido
- Tamaño dentro del límite
- Ownership (para request photos, valida que el usuario sea el cliente)

##### `getFile(filePath)`
Obtiene los metadatos de un archivo.

##### `deleteFile(filePath, userId, isAdmin)`
Elimina un archivo validando:
- Existencia del archivo
- Permisos (owner o admin)

##### `canAccessFile(filePath, userId, isAdmin)`
Valida si un usuario puede acceder a un archivo:
- Admin → Siempre permitido
- Público → Siempre permitido
- Owner → Permitido
- Participant (para requests) → Permitido si es cliente o profesional

---

## Endpoints API

### 1. Subir Archivo

```http
POST /api/storage/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Body**:
- `file`: Archivo (binary)
- `category`: `profile-picture` | `project-image` | `project-video` | `request-photo`
- `requestId`: UUID (opcional, solo para `request-photo`)

**Response** (201):
```json
{
  "id": "uuid",
  "originalFilename": "foto.jpg",
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

### 2. Obtener Archivo Público

```http
GET /api/storage/public/{path}
```

**Ejemplo**:
```
GET /api/storage/public/profile-pictures/user123/abc123.jpg
```

**Response**: Archivo binario (imagen/video)

### 3. Obtener Archivo Privado

```http
GET /api/storage/private/{path}
Authorization: Bearer {token}
```

**Ejemplo**:
```
GET /api/storage/private/requests/req456/xyz789.jpg
```

**Response**: Archivo binario (si tiene permisos)

### 4. Eliminar Archivo

```http
DELETE /api/storage/{path}
Authorization: Bearer {token}
```

**Ejemplo**:
```
DELETE /api/storage/public/profile-pictures/user123/abc123.jpg
```

**Response**: 204 No Content

---

## Configuración

### Variables de Entorno

Agregar al archivo `.env`:

```env
# Ruta donde se almacenan los archivos localmente
STORAGE_LOCAL_PATH=./uploads

# URL base para generar URLs de archivos
STORAGE_BASE_URL=http://localhost:5000/api/storage

# Proveedor de almacenamiento (futuro)
STORAGE_PROVIDER=local
```

### Configuración del Módulo

El módulo se registra automáticamente en `app.module.ts`:

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

## Uso y Ejemplos

### Ejemplo 1: Subir Foto de Perfil

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

### Ejemplo 2: Subir Foto de Solicitud

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

### Ejemplo 3: Obtener Archivo Público

```typescript
// No requiere autenticación
const imageUrl = 'http://localhost:5000/api/storage/public/profile-pictures/user123/abc123.jpg';
<img src={imageUrl} alt="Profile" />
```

### Ejemplo 4: Obtener Archivo Privado

```typescript
// Requiere autenticación y permisos
const imageUrl = 'http://localhost:5000/api/storage/private/requests/req456/xyz789.jpg';
// Usar con token en headers o como query param
```

---

## Extensibilidad

### Agregar Nueva Categoría

1. **Agregar al enum**:
```typescript
// domain/value-objects/file-category.vo.ts
export enum FileCategory {
  // ... existentes
  NEW_CATEGORY = 'new-category',
}
```

2. **Definir acceso y path**:
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

3. **Actualizar validaciones** en `FileTypeVO` si es necesario.

### Agregar Nuevo Tipo MIME

1. **Agregar al enum**:
```typescript
// domain/value-objects/file-type.vo.ts
export enum AllowedMimeType {
  // ... existentes
  IMAGE_SVG = 'image/svg+xml',
}
```

2. **Actualizar validaciones**:
```typescript
private getAllowedTypesForCategory(): AllowedMimeType[] {
  switch (this.category) {
    case 'profile-picture':
      return [
        // ... existentes
        AllowedMimeType.IMAGE_SVG,
      ];
  }
}
```

---

## Migración a S3/Azure

### Paso 1: Crear Nueva Implementación

Crear `S3FileStorageRepository`:

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
    // ... crear FileEntity
  }

  async delete(filePath: string): Promise<void> {
    await this.s3Client.deleteObject({
      Bucket: this.bucketName,
      Key: filePath,
    });
  }

  // ... implementar otros métodos
}
```

### Paso 2: Actualizar Módulo

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

### Paso 3: Configuración

```env
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Ventajas del Diseño

- ✅ **Sin cambios en el código de negocio**: El servicio y controlador no cambian
- ✅ **Intercambiable**: Solo cambiar la implementación del repositorio
- ✅ **Testeable**: Fácil de mockear en tests
- ✅ **Múltiples proveedores**: Puede tener varias implementaciones activas

---

## Consideraciones Futuras

### 1. Base de Datos para Metadatos

Actualmente, los metadatos se extraen del sistema de archivos. Para producción, considerar:

- Crear tabla `files` en Prisma
- Almacenar metadatos al subir
- Consultar desde DB en lugar del filesystem

### 2. URLs Firmadas

Para archivos privados, implementar URLs con expiración:

```typescript
GET /api/storage/generate-signed-url/:path
→ { url: "https://...?token=...&expires=..." }
```

### 3. Optimización de Imágenes

- Redimensionamiento automático
- Generación de thumbnails
- Conversión de formatos

### 4. CDN Integration

- Configurar CDN para archivos públicos
- Invalidación de caché
- Distribución geográfica

---

## Testing

### Ejemplo de Test Unitario

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
- Verificar que el archivo existe en la ruta especificada
- Verificar permisos del sistema de archivos
- Verificar que `STORAGE_LOCAL_PATH` está configurado correctamente

### Error: "Mime type not allowed"
- Verificar que el tipo MIME está en la lista permitida para la categoría
- Verificar que el archivo no está corrupto

### Error: "File size exceeds maximum"
- Verificar límites: 10MB para imágenes, 100MB para videos
- Comprimir archivos antes de subir si es necesario

### Error: "You do not have permission"
- Verificar que el usuario está autenticado (para archivos privados)
- Verificar ownership o participación en la solicitud
- Verificar si el usuario es admin

---

## Conclusión

El módulo de Storage proporciona una solución robusta, extensible y segura para el manejo de archivos multimedia. Su diseño desacoplado permite migrar fácilmente a proveedores cloud sin afectar el código de negocio, mientras que el sistema de permisos granular asegura que solo los usuarios autorizados puedan acceder a los archivos.

Para más información o soporte, consultar la documentación del proyecto o contactar al equipo de desarrollo.

