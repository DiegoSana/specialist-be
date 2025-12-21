# Persistence Boundaries (DDD) - Specialist Backend
**Last updated:** December 2025

This document describes how persistence is modeled in the codebase in a DDD-aligned way, and how we avoid leaking ORM/filesystem concerns into the domain.

## Principles

### 1) Aggregate repositories are “collections”
For aggregates, repository interfaces are modeled as a collection-like abstraction:

- **Load**: `findById(...)`, `findByX(...)`
- **Persist**: `save(aggregate)`

We intentionally avoid generic patch APIs like `update(id, Partial<Entity>)` in repository contracts because:

- they do not express business intent,
- they allow updating fields that should not be updated,
- they make invariants easier to bypass,
- they couple persistence operations to the internal shape of the entity.

### 2) Domain ↔ persistence mapping lives in infrastructure
Infrastructure adapters (e.g. Prisma repositories) are responsible for mapping:

- persistence model → domain entity (**toDomain**)
- domain entity → persistence writes (**toPersistence** / **toPersistenceSave**)

This keeps Prisma types/records out of the domain layer.

### 3) Association repositories are explicit (add/remove)
Some concepts are not “aggregates you update”, but associations you add/remove.

Example: `RequestInterest` is modeled with explicit operations:

- `add({ requestId, professionalId, message })`
- `remove(requestId, professionalId)`
- `removeAllByRequestId(requestId)`

This is clearer than forcing a `save(interest)` API.

### 4) Infrastructure ports are not aggregate repositories
Some “repositories” are actually infrastructure capabilities (ports), not aggregate persistence.

Example: file storage is a **port** (`FileStoragePort`) implemented by adapters such as `LocalFileStorageRepository`.
This interface represents external IO operations (upload/delete/exists/getUrl), not aggregate persistence.

## Current conventions in this repository

### Aggregate repositories (Option A)
These repositories use `save(...)` as the write primitive:

- `UserRepository` (Identity)
- `ProfessionalRepository` (Profiles)
- `ClientRepository` (Profiles)
- `RequestRepository` (Requests)
- `ReviewRepository` (Reputation)
- `TradeRepository` (Profiles)

### Explicit association stores (add/remove)
- `RequestInterestRepository` (Requests)
- `ContactRepository` (Contact) is modeled as an append-only log (`create + query`)

### Notes on derived flags
`User.hasClientProfile` and `User.hasProfessionalProfile` are derived from the existence of related records.
To compute them reliably, persistence reads must include those relations (or use a read-model).
