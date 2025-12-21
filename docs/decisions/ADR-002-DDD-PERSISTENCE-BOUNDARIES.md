# ADR-002: DDD Persistence Boundaries (Aggregate Repositories, Association Stores, and Infrastructure Ports)

**Status:** Accepted  
**Date:** December 2025  
**Decision Makers:** Development Team

---

## Context

The codebase follows a Clean Architecture + DDD structure (domain / application / infrastructure / presentation). Over time, repository contracts drifted toward CRUD-style APIs such as `update(id, Partial<Entity>)`, and persistence concerns leaked into domain/application code:

- generic patch updates did not express business intent,
- it became easy to update fields that should not change,
- mapping logic was duplicated inside repositories and services,
- “repositories” were used for non-aggregate concerns (e.g. file storage), which blurred architectural boundaries.

We want repository contracts to reflect DDD more firmly and keep persistence details in infrastructure.

---

## Decision

We adopt the following conventions:

### 1) Aggregate repositories are “collections” (Option A)
For aggregate roots, repository interfaces expose:

- **Load**: `findById(...)`, `findByX(...)`
- **Persist**: `save(aggregate)`

We explicitly avoid `update(id, Partial<Entity>)` in repository contracts.

### 2) Domain ↔ persistence mapping is bidirectional and lives in infrastructure
Infrastructure adapters (e.g. Prisma repositories) own mapping:

- persistence record → domain entity (`toDomain`)
- domain entity → persistence writes (`toPersistenceSave` / `toPersistenceCreate`)

### 3) Association stores use explicit add/remove operations
Not everything is a mutable aggregate. Some concepts are associations that are naturally modeled as “append/remove”:

- `RequestInterestRepository.add/remove/removeAllByRequestId`
- `ContactRepository` is treated as an append-only communication log

### 4) Infrastructure ports are not aggregate repositories
Some interfaces represent external capabilities, not aggregate persistence:

- file storage is modeled as a **port** (`FileStoragePort`), implemented by infrastructure adapters (e.g. local filesystem, S3).

---

## Consequences

### Positive
- Repository contracts better express the domain model and reduce accidental updates.
- Persistence concerns remain in infrastructure (Prisma types do not leak into the domain).
- Association lifecycles become clearer (add/remove instead of patching).
- Storage is cleanly modeled as IO (port + adapter), making it easier to swap providers.

### Negative / Tradeoffs
- Writing changes can be more verbose (constructing a new entity and saving it).
  - Mitigation: add domain factories and “withChanges/withX” methods.
- Some read-heavy operations remain as query methods in repositories until a dedicated read-model/query repository is introduced.

---

## Implementation Notes

- Aggregate repositories using `save(...)`: `User`, `Professional`, `Client`, `Request`, `Review`, `Trade`.
- Associations: `RequestInterest` uses `add/remove`, `Contact` is append-only.
- Storage: `FileStoragePort` is introduced with a backward-compatible alias for `FileStorageRepository`.

---

## References

- Eric Evans, *Domain-Driven Design*
- Clean Architecture / Hexagonal Architecture (Ports & Adapters)

