# Specialist Backend - Documentation

> Complete documentation for the Specialist marketplace backend API.

## 📚 Table of Contents

### API Reference
- [**API.md**](./API.md) - REST API endpoints reference

### Architecture
- [**ARCHITECTURE.md**](./architecture/ARCHITECTURE.md) - System architecture and bounded contexts
- [**DOMAIN_MODEL.md**](./architecture/DOMAIN_MODEL.md) - Domain entities and relationships
- [**ROLES_ARCHITECTURE.md**](./architecture/ROLES_ARCHITECTURE.md) - User roles and permissions
- [**AUTHORIZATION_PATTERN.md**](./architecture/AUTHORIZATION_PATTERN.md) - Hybrid Service + Domain permission validation ⭐
- [**STORAGE_IMPLEMENTATION.md**](./architecture/STORAGE_IMPLEMENTATION.md) - File storage system design
- [**COMPANY_PROFILES.md**](./architecture/COMPANY_PROFILES.md) - Company profiles design & business rules ⭐ NEW

### Guides
- [**DOCKER.md**](./guides/DOCKER.md) - Docker setup and commands
- [**POSTMAN_GUIDE.md**](./guides/POSTMAN_GUIDE.md) - API testing with Postman
- [**MIGRATION_GUIDE.md**](./guides/MIGRATION_GUIDE.md) - Database migration guide
- [**NOTIFICATIONS.md**](./guides/NOTIFICATIONS.md) - Email notifications & preferences
- [**REVIEW_MODERATION.md**](./guides/REVIEW_MODERATION.md) - Review approval workflow

### Architecture Decision Records (ADRs)
- [**ADR-001-DUAL-PROFILE-ARCHITECTURE.md**](./decisions/ADR-001-DUAL-PROFILE-ARCHITECTURE.md) - Dual profile system (client + professional)
- [**ADR-004-SERVICE-PROVIDER-ABSTRACTION.md**](./decisions/ADR-004-SERVICE-PROVIDER-ABSTRACTION.md) - ServiceProvider polymorphic pattern ⭐ NEW

---

## 🚀 Quick Links

| Resource | Description |
|----------|-------------|
| [Swagger UI](http://localhost:5000/api/docs) | Interactive API documentation (local) |
| [Health Check](http://localhost:5000/api/health) | Service health status |
| [GitHub Repository](https://github.com/DiegoSana/specialist-be) | Source code |

## 📁 Project Structure

```
specialist-be/
├── docs/
│   ├── README.md           # This file
│   ├── API.md              # API reference
│   ├── architecture/       # System design docs
│   ├── guides/             # How-to guides
│   └── decisions/          # ADRs
├── src/
│   ├── identity/           # Authentication & users
│   ├── profiles/           # Service providers (professionals, companies, trades)
│   ├── requests/           # Service requests & interest matching
│   ├── reputation/         # Reviews & ratings (with moderation)
│   ├── notifications/      # In-app & email notifications
│   ├── storage/            # File management
│   ├── admin/              # Admin operations
│   ├── contact/            # Contact requests
│   └── shared/             # Common utilities
├── test/
│   ├── jest-e2e.json       # E2E test configuration
│   ├── test-setup.ts       # E2E test utilities
│   ├── companies.e2e-spec.ts
│   └── requests.e2e-spec.ts
├── prisma/
│   └── schema.prisma       # Database schema
└── README.md               # Project overview
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development
npm run start:dev

# Run tests
npm test

# Build for production
npm run build
```

## 📝 Contributing

When adding new documentation:
1. **API changes** → Update `API.md`
2. **Architecture changes** → Add/update in `architecture/`
3. **New guides** → Add to `guides/`
4. **Design decisions** → Create ADR in `decisions/`

