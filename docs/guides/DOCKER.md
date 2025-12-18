# Docker Setup Guide

This guide explains how to run the Especialistas API using Docker.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start

### Production Mode

```bash
# Copy environment file
cp .docker-compose.env.example .env

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Development Mode

```bash
# Start in development mode (with hot-reload)
docker-compose -f docker-compose.dev.yml up

# In another terminal, run migrations
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

**Note**: In development mode, the API runs on port **5000** by default (configurable via `PORT` environment variable).

## Services

### PostgreSQL Database
- **Container**: `especialistas-db-dev` (development) / `especialistas-db` (production)
- **Port**: `5432`
- **Default credentials**: 
  - User: `postgres`
  - Password: `postgres`
  - Database: `especialistas`

### NestJS API
- **Container**: `especialistas-api-dev` (development) / `especialistas-api` (production)
- **Port**: `5000` (development) / `3000` (production)
- **API**: 
  - Development: `http://0.0.0.0:5000/api` (use `0.0.0.0` instead of `localhost` or `127.0.0.1`)
  - Production: `http://localhost:3000/api`
- **Swagger**: 
  - Development: `http://0.0.0.0:5000/api/docs` (use `0.0.0.0` instead of `localhost` or `127.0.0.1`)
  - Production: `http://localhost:3000/api/docs`

## Common Commands

### Using Docker Compose

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Stop services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Restart services
docker-compose -f docker-compose.dev.yml restart

# Remove volumes (clean database)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild images
docker-compose -f docker-compose.dev.yml build

# Execute commands in container
docker-compose -f docker-compose.dev.yml exec app <command>
```

### Using Makefile

```bash
# Show all available commands
make help

# Start services
make up

# Stop services
make down

# View logs
make logs

# Development mode
make dev-up

# Run migrations
make migrate

# Open Prisma Studio
make studio
```

## Database Migrations

### Production
Migrations run automatically on container start using `prisma migrate deploy`.

### Development
Run migrations manually:

```bash
# Create a new migration
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev --name migration-name

# Apply migrations
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
```

## Environment Variables

Create a `.env` file based on `.docker-compose.env.example`:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=especialistas
POSTGRES_PORT=5432
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
```

## Prisma Configuration

The Prisma schema includes `binaryTargets` for Docker compatibility:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

This ensures Prisma Client works correctly in Alpine Linux containers.

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL container is healthy: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`
- Verify DATABASE_URL in container: `docker-compose exec app env | grep DATABASE_URL`

### Application not starting
- Check application logs: `docker-compose logs -f app`
- Verify environment variables: `docker-compose exec app env`
- Rebuild images: `docker-compose build --no-cache`

### Port already in use
- Change PORT in `.env` file
- Or stop the service using the port: `sudo lsof -i :5000` (development) or `sudo lsof -i :3000` (production)

### Prisma migration errors
- Reset database: `docker-compose down -v && docker-compose up -d`
- Run migrations manually: `docker-compose exec app npx prisma migrate deploy`
- Regenerate Prisma Client: `docker-compose exec app npx prisma generate`

### Prisma Client binary compatibility
If you see errors about Prisma Client binaries:
- Ensure `binaryTargets` in `schema.prisma` includes `linux-musl-openssl-3.0.x`
- Regenerate Prisma Client: `docker-compose exec app npx prisma generate`

## Volumes

- `postgres_data`: PostgreSQL data (production)
- `postgres_data_dev`: PostgreSQL data (development)

To remove volumes and start fresh:
```bash
docker-compose -f docker-compose.dev.yml down -v
```
