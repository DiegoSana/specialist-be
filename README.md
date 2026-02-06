# Specialist - Professional Marketplace API

[![Deploy to Fly.io](https://github.com/DiegoSana/specialist-be/actions/workflows/deploy.yml/badge.svg)](https://github.com/DiegoSana/specialist-be/actions/workflows/deploy.yml)

NestJS REST API with DDD (Domain-Driven Design) architecture that connects users with verified professionals in Bariloche.

## 🏗️ Architecture

The application follows DDD principles organized in bounded contexts:

| Context | Description |
|---------|-------------|
| **Identity** | Authentication, users, JWT tokens |
| **Profiles** | Professional profiles, trades, client profiles |
| **Requests** | Service requests, interests, assignments |
| **Reputation** | Reviews and ratings |
| **Storage** | File uploads and media |
| **Admin** | Administrative operations (see [Admin Portal Plan](./docs/plans/admin-portal-plan.md)) |
| **Contact** | Contact requests between users |
| **Notifications** | In-app and email notifications |

Each context follows the layered architecture:
- **Domain**: Entities, Value Objects, Repository Interfaces
- **Application**: Services, DTOs
- **Infrastructure**: Repository Implementations
- **Presentation**: Controllers, Guards

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (or Docker)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start in development mode
npm run start:dev
```

### With Docker

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app
```

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development with hot-reload |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run prisma:studio` | Open Prisma Studio |

## 🔧 Technologies

- **NestJS 10** - Node.js framework
- **Prisma ORM** - Database toolkit
- **PostgreSQL** - Database
- **JWT + Passport** - Authentication
- **TypeScript** - Type safety
- **Jest** - Testing

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [**docs/**](./docs/README.md) | 📖 Full documentation index |
| [**API Reference**](./docs/API.md) | REST API endpoints |
| [**Architecture**](./docs/architecture/ARCHITECTURE.md) | System design |
| [**Swagger UI**](http://localhost:5000/api/docs) | Interactive API docs |

### Quick API Overview

```
/api/auth/*                    → Authentication (login, register, OAuth)
/api/users/*                   → User profile management
/api/identity/verification/*   → Email & phone verification (Twilio)
/api/professionals/*           → Professional profiles & search
/api/companies/*               → Company profiles & search
/api/providers                 → Unified provider catalog (filter by type)
/api/trades/*                  → Service categories
/api/requests/*                → Service requests & interests
/api/reviews/*                 → Reviews & ratings
/api/notifications/*           → In-app notifications & preferences
/api/storage/*                 → File uploads
/api/admin/*                   → Admin operations
/api/health/*                  → Health checks
```

See [API Reference](./docs/API.md) and [API Structure](./docs/API_STRUCTURE.md) for full endpoint details.

## 🔐 Authentication

JWT Bearer tokens in Authorization header:
```
Authorization: Bearer <token>
```

OAuth supported: Google, Facebook. Email and phone verification via Twilio (see [Environment Variables](./docs/guides/ENVIRONMENT_VARIABLES.md)).

## 🌐 Deployment

- **Production API**: https://specialist-api.fly.dev
- **Health Check**: https://specialist-api.fly.dev/api/health

## 📊 Test Coverage

```
289 tests passing
```

## 📖 More Documentation

See the full documentation in [`docs/`](./docs/README.md):

- [API Reference](./docs/API.md)
- [API Structure](./docs/API_STRUCTURE.md)
- [Architecture](./docs/architecture/ARCHITECTURE.md)
- [Authorization Pattern](./docs/architecture/AUTHORIZATION_PATTERN.md)
- [Permissions by Role](./docs/guides/PERMISSIONS_BY_ROLE.md)
- [Domain Model](./docs/architecture/DOMAIN_MODEL.md)
- [Docker Guide](./docs/guides/DOCKER.md)
- [Migration Guide](./docs/guides/MIGRATION_GUIDE.md)
- [Environment Variables](./docs/guides/ENVIRONMENT_VARIABLES.md)

