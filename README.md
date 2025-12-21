# Specialist - Professional Marketplace API

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
| **Admin** | Administrative operations |
| **Contact** | Contact requests between users |

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
/api/auth/*           → Authentication (login, register, OAuth)
/api/users/*          → User profile management
/api/professionals/*  → Professional profiles & search
/api/trades/*         → Service categories
/api/requests/*       → Service requests & interests
/api/reviews/*        → Reviews & ratings
/api/storage/*        → File uploads
/api/admin/*          → Admin operations
/api/health/*         → Health checks
```

## 🔐 Authentication

JWT Bearer tokens in Authorization header:
```
Authorization: Bearer <token>
```

OAuth supported: Google, Facebook

## 🌐 Deployment

- **Production API**: https://specialist-api.fly.dev
- **Health Check**: https://specialist-api.fly.dev/api/health

## 📊 Test Coverage

```
193 tests passing
```

## 📖 More Documentation

See the full documentation in [`docs/`](./docs/README.md):

- [API Reference](./docs/API.md)
- [Architecture](./docs/architecture/ARCHITECTURE.md)
- [Domain Model](./docs/architecture/DOMAIN_MODEL.md)
- [Docker Guide](./docs/guides/DOCKER.md)
- [Migration Guide](./docs/guides/MIGRATION_GUIDE.md)

