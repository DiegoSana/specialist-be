.PHONY: help build up down logs restart clean dev-up dev-down migrate

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker-compose build

up: ## Start services in production mode
	docker-compose up -d

down: ## Stop services
	docker-compose down

logs: ## View application logs
	docker-compose logs -f app

restart: ## Restart services
	docker-compose restart

clean: ## Stop services and remove volumes
	docker-compose down -v

dev-up: ## Start services in development mode
	docker-compose -f docker-compose.dev.yml up

dev-down: ## Stop development services
	docker-compose -f docker-compose.dev.yml down

migrate: ## Run database migrations
	docker-compose exec app npx prisma migrate deploy

migrate-dev: ## Run database migrations in development
	docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev

studio: ## Open Prisma Studio
	docker-compose exec app npx prisma studio

studio-dev: ## Open Prisma Studio in development
	docker-compose -f docker-compose.dev.yml exec app npx prisma studio

shell: ## Open shell in app container
	docker-compose exec app sh

shell-dev: ## Open shell in development app container
	docker-compose -f docker-compose.dev.yml exec app sh

