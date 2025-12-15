# Specialist - Professional Marketplace API

NestJS REST API with DDD (Domain-Driven Design) architecture that connects users with verified professionals in Bariloche.

## 🏗️ Architecture

The application follows DDD principles with the following layers:

- **Domain**: Entities, Value Objects, Domain Services, Repository Interfaces
- **Application**: Use Cases, DTOs, Application Services
- **Infrastructure**: Repository Implementations, External Services
- **Presentation**: Controllers, Guards, Pipes, Decorators

## 📦 Modules

- **User Management**: User authentication, registration, and profile management
- **Service**: Trades, professionals, and service requests management
- **Reputation**: Rating and review system
- **Contact**: Contact requests between users
- **Admin**: User and professional moderation panel

## 🚀 Quick Start

### Option 1: Docker (Recommended)

#### Prerequisites
- Docker
- Docker Compose

#### Installation with Docker

```bash
# Copy environment file
cp .docker-compose.env.example .env

# Edit .env with your configuration (optional, defaults are provided)

# Start all services (database + API)
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean database)
docker-compose -f docker-compose.dev.yml down -v
```

#### Development Mode with Docker

```bash
# Start in development mode with hot-reload
docker-compose -f docker-compose.dev.yml up

# In another terminal, run migrations if needed
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

**Note**: The API runs on port **5000** in development mode (configurable via `PORT` environment variable).

### Option 2: Local Development

#### Prerequisites
- Node.js 18+
- PostgreSQL
- npm or yarn

#### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .docker-compose.env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start in development mode
npm run start:dev
```

## 📝 Scripts

### Local Development
- `npm run start:dev` - Development with hot-reload
- `npm run build` - Build for production
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run test` - Run tests

### Docker Commands
- `docker-compose -f docker-compose.dev.yml up -d` - Start services in background
- `docker-compose -f docker-compose.dev.yml up` - Start services in foreground
- `docker-compose -f docker-compose.dev.yml down` - Stop services
- `docker-compose -f docker-compose.dev.yml down -v` - Stop services and remove volumes
- `docker-compose -f docker-compose.dev.yml logs -f app` - View application logs
- `docker-compose -f docker-compose.dev.yml exec app npx prisma studio` - Open Prisma Studio in container
- `docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev` - Run migrations in container

## 🔧 Technologies

- NestJS 10
- Prisma ORM
- PostgreSQL
- JWT + Passport
- TypeScript

## 📚 API Documentation

Once the server is running, access Swagger documentation at:
- Development: `http://0.0.0.0:5000/api/docs` (use `0.0.0.0` instead of `localhost` or `127.0.0.1`)
- Production: `http://localhost:3000/api/docs`

## 🔐 Authentication

The API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### User Management
- `GET /api/users/profile` - Get current user profile (authenticated)
- `PUT /api/users/profile` - Update user profile (authenticated)

### Service
- `GET /api/service/trades` - List all trades (public)
- `GET /api/service/trades/:id` - Get trade by ID (public)
- `GET /api/service/professionals` - Search professionals (public)
- `GET /api/service/professionals/:id` - Get professional by ID (public)
- `GET /api/service/professionals/me/profile` - Get current professional profile (authenticated)
- `POST /api/service/professionals/me/profile` - Create professional profile (authenticated)
- `PUT /api/service/professionals/me/profile` - Update professional profile (authenticated)
- `POST /api/service/requests` - Create service request (authenticated)
- `GET /api/service/requests` - Get my requests (authenticated)
- `GET /api/service/requests/:id` - Get request by ID (authenticated)
- `PUT /api/service/requests/:id` - Update request status (authenticated)

### Reputation
- `GET /api/reputation/professionals/:professionalId/reviews` - Get reviews for a professional (public)
- `GET /api/reputation/reviews/:id` - Get review by ID (authenticated)
- `POST /api/reputation/reviews` - Create a review (authenticated)
- `PUT /api/reputation/reviews/:id` - Update a review (authenticated)
- `DELETE /api/reputation/reviews/:id` - Delete a review (authenticated)

### Contact
- `POST /api/contact` - Create a contact request (authenticated)
- `GET /api/contact` - Get my contact requests (authenticated)

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/users/:id` - Get user by ID (admin only)
- `PUT /api/admin/users/:id/status` - Update user status (admin only)
- `GET /api/admin/professionals` - Get all professional profiles (admin only)
- `PUT /api/admin/professionals/:id/status` - Update professional status (admin only)

## 🗄️ Database Migrations

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions.

## 📖 Additional Documentation

- [Domain Model](./DOMAIN_MODEL.md) - DDD bounded contexts and domain entities
- [Roles Architecture](./ROLES_ARCHITECTURE.md) - User roles and permissions
- [Docker Setup](./DOCKER.md) - Docker configuration and troubleshooting
- [Migration Guide](./MIGRATION_GUIDE.md) - Prisma migrations guide
