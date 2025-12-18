# Specialist Backend - Documentation

> Complete documentation for the Specialist marketplace backend API.

## 📚 Table of Contents

### API Reference
- [**API.md**](./API.md) - REST API endpoints reference

### Architecture
- [**ARCHITECTURE.md**](./architecture/ARCHITECTURE.md) - System architecture and bounded contexts
- [**DOMAIN_MODEL.md**](./architecture/DOMAIN_MODEL.md) - Domain entities and relationships
- [**ROLES_ARCHITECTURE.md**](./architecture/ROLES_ARCHITECTURE.md) - User roles and permissions
- [**STORAGE_IMPLEMENTATION.md**](./architecture/STORAGE_IMPLEMENTATION.md) - File storage system design

### Guides
- [**DOCKER.md**](./guides/DOCKER.md) - Docker setup and commands
- [**POSTMAN_GUIDE.md**](./guides/POSTMAN_GUIDE.md) - API testing with Postman
- [**MIGRATION_GUIDE.md**](./guides/MIGRATION_GUIDE.md) - Database migration guide

### Architecture Decision Records (ADRs)
- [**DUAL_ROLE_OPTIONS.md**](./decisions/DUAL_ROLE_OPTIONS.md) - Client/Professional dual role analysis
- [**OPTION1_VS_OPTION5_DEEP_DIVE.md**](./decisions/OPTION1_VS_OPTION5_DEEP_DIVE.md) - Architecture options comparison
- [**OPTION5_IMPLEMENTATION_EXAMPLE.md**](./decisions/OPTION5_IMPLEMENTATION_EXAMPLE.md) - Selected architecture implementation
- [**OPTION5_IMPLEMENTATION_SUMMARY.md**](./decisions/OPTION5_IMPLEMENTATION_SUMMARY.md) - Implementation summary
- [**INHERITANCE_VS_COMPOSITION.md**](./decisions/INHERITANCE_VS_COMPOSITION.md) - Design pattern decision

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
│   ├── profiles/           # Professionals & trades
│   ├── requests/           # Service requests
│   ├── reputation/         # Reviews & ratings
│   ├── storage/            # File management
│   ├── admin/              # Admin operations
│   ├── contact/            # Contact requests
│   └── shared/             # Common utilities
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

