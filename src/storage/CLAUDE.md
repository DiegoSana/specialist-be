# Storage context (`src/storage`)

File uploads (profile pictures, project gallery images/videos, request photos) behind a storage
port. Docs: `docs/architecture/STORAGE_IMPLEMENTATION.md`.

## Public API (exported by `StorageModule`)

`FileStorageService`: `uploadFile(user, file, dto)`, `getFile(path)`, `deleteFile(user, path)`,
`canAccessFile(user, path)`. Consumers (Profiles, Requests) call this service; they never touch
the filesystem.

## Endpoints

`POST /storage/upload` (multipart `file`, `category`, optional `requestId`; JWT),
`GET /storage/public/:path(*)` (`@Public()`), `GET /storage/private/:path(*)` and
`DELETE /storage/:path(*)` (JWT + `FileAccessGuard`).

## Domain

- `FileEntity`; value objects `FileCategory` (`PROFILE_PICTURE`, `PROJECT_IMAGE`, `PROJECT_VIDEO`
  public; `REQUEST_PHOTO` private under `private/requests/{requestId}/`), `FileType` (allowed
  MIME: `image/jpeg|png|webp|gif`, `video/mp4|webm|quicktime`), `FileSize` (10MB images, 100MB
  videos).
- Port `FileStoragePort` (`FILE_STORAGE_REPOSITORY` token; `FileStorageRepository` is a type
  alias for back-compat): `upload/delete/exists/getUrl`. Implementation
  `LocalFileStorageRepository` (`./uploads`). This is an infrastructure port, not an aggregate
  repository (see PERSISTENCE_BOUNDARIES.md).

## Access rules (`FileAccessGuard` order)

admin -> public path -> owner -> request participant (client or assigned provider) -> deny. Only
the request's client uploads request photos; only the owner deletes.

## Gotchas

- Swapping to S3/Cloudinary = new adapter + provider switch in `storage.module.ts`; do not change
  service/controller code. `CLOUDINARY_*` env vars exist but are not wired.
- Stored names are UUIDs; original names only in metadata.
- No signed URLs yet; private files are streamed through the API.

## Tests

`file-storage.service.spec.ts`.
