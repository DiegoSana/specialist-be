# Contact context (`src/contact`)

Append-only log of contact requests between users. `ContactRepository` is modeled as
`create + query` (not an aggregate with `save`). Endpoints: `POST /contact`, `GET /contact` (JWT).
`ContactService`: `create(userId, dto)`, `findByUserId`. Keep it simple; if it grows into
messaging, propose a new bounded context (ADR) instead of extending this one.
Tests: `contact.service.spec.ts`.
