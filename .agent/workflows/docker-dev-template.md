---
description: Template for spinning up a Docker-first dev environment with make dev
---

# Docker Dev Environment Template

This template provides a reusable `Makefile` pattern for spinning up a full Docker-first development environment. Adapt this to any project that uses Docker Compose.

---

## Template Makefile

```makefile
# [PROJECT_NAME] - Project Automation
# Docker-first development workflow

# ============================================================================
# CONFIGURATION (Customize per project)
# ============================================================================
COMPOSE_FILE := docker-compose.yml
BACKEND_SERVICE := backend          # Main backend service name
FRONTEND_SERVICE := frontend        # Frontend service name (if any)
DB_SERVICE := postgres              # Database service name
BACKEND_PORT := 8000               # Port for backend
FRONTEND_PORT := 5173              # Port for frontend (if any)
DB_WAIT_SECONDS := 5               # Seconds to wait for DB readiness
API_WAIT_SECONDS := 3              # Seconds to wait for API readiness

# Optional: Path to local Python venv (for scripts outside Docker)
VENV_PYTHON := backend\venv\Scripts\python  # Windows
# VENV_PYTHON := backend/venv/bin/python    # Linux/Mac

.PHONY: default dev setup clean migrate seed test logs help

# ============================================================================
# HELP
# ============================================================================
default: help

help:
	@echo ""
	@echo "  [PROJECT_NAME]"
	@echo "  =============="
	@echo ""
	@echo "  Core Workflows:"
	@echo "    make setup       - FRESH START: Down, Build, Up, Migrate (Data Loss!)"
	@echo "    make dev         - Daily startup (Docker up + sync)"
	@echo "    make migrate     - Generate new database migration"
	@echo "    make seed        - Populate database with seed data"
	@echo "    make clean       - Stop containers and remove volumes"
	@echo ""
	@echo "  Development:"
	@echo "    make logs        - Follow container logs"
	@echo "    make test        - Run tests"
	@echo "    make shell       - Open shell in backend container"
	@echo ""

# ============================================================================
# CORE WORKFLOWS
# ============================================================================

# 1. Setup - "Fresh Start" command
#    Stops everything, removes volumes (cleans DB), rebuilds, starts, migrates.
setup:
	@echo ""
	@echo "🛑 Stopping containers and removing volumes..."
	docker-compose down -v
	@echo ""
	@echo "🏗️  Building containers..."
	docker-compose build
	@echo ""
	@echo "🚀 Starting services..."
	docker-compose up -d
	@echo ""
	@echo "⏳ Waiting for database to be ready ($(DB_WAIT_SECONDS)s)..."
	@timeout /t $(DB_WAIT_SECONDS) /nobreak > nul   # Windows
	# @sleep $(DB_WAIT_SECONDS)                     # Linux/Mac
	@echo ""
	@echo "🔄 Running migrations..."
	docker-compose exec $(BACKEND_SERVICE) alembic upgrade head
	@echo ""
	@echo "✅ Setup complete!"
	@echo "   Backend:  http://localhost:$(BACKEND_PORT)"
	@echo "   Frontend: http://localhost:$(FRONTEND_PORT)"

# 2. Dev - Standard daily workflow
#    Starts containers with force-recreate, runs sync, shows logs.
dev:
	@echo ""
	@echo "🚀 Starting Docker Containers (Recreating)..."
	docker-compose up -d --force-recreate
	@echo ""
	@echo "⏳ Waiting for API to be ready ($(API_WAIT_SECONDS)s)..."
	@timeout /t $(API_WAIT_SECONDS) /nobreak > nul   # Windows
	# @sleep $(API_WAIT_SECONDS)                     # Linux/Mac
	@$(MAKE) sync
	@echo ""
	@echo "   Backend:  http://localhost:$(BACKEND_PORT)"
	@echo "   Frontend: http://localhost:$(FRONTEND_PORT)"
	@echo ""
	@echo "📝 Showing logs (Ctrl+C to exit logs, containers keep running)..."
	docker-compose logs -f $(BACKEND_SERVICE) $(FRONTEND_SERVICE)

# 3. Sync - Project-specific sync tasks
#    Customize this for your project (API types, codegen, etc.)
sync:
	@echo "🔄 Running sync tasks..."
	# Example: Generate API types from OpenAPI schema
	# @cd frontend && npm run generate-api
	@echo "✅ Sync complete."

# 4. Clean - Stop and remove everything
clean:
	@echo ""
	@echo "🧹 Deep cleaning..."
	docker-compose down -v
	@echo "✅ Environment cleaned."

# ============================================================================
# DATABASE
# ============================================================================

# Generate new Alembic migration
migrate:
	@echo ""
	@echo "🐘 Generating Migration..."
	docker-compose exec $(BACKEND_SERVICE) alembic revision --autogenerate -m "auto_migration"
	@echo "✅ Migration created!"

# Apply pending migrations
migrate-up:
	@echo "🔄 Applying migrations..."
	docker-compose exec $(BACKEND_SERVICE) alembic upgrade head

# Rollback last migration
migrate-down:
	@echo "⏪ Rolling back last migration..."
	docker-compose exec $(BACKEND_SERVICE) alembic downgrade -1

# Seed database
seed:
	@echo "🌱 Seeding database..."
	docker-compose exec $(BACKEND_SERVICE) python seed_cli.py

# ============================================================================
# TESTING & QUALITY
# ============================================================================

test:
	@echo "🧪 Running tests..."
	docker-compose exec $(BACKEND_SERVICE) pytest

test-cov:
	@echo "📊 Running tests with coverage..."
	docker-compose exec $(BACKEND_SERVICE) pytest --cov=app --cov-report=term-missing

lint:
	@echo "🎨 Linting..."
	docker-compose exec $(BACKEND_SERVICE) ruff check .

lint-fix:
	@echo "🔧 Fixing lint errors..."
	docker-compose exec $(BACKEND_SERVICE) ruff check . --fix

format:
	@echo "✨ Formatting code..."
	docker-compose exec $(BACKEND_SERVICE) ruff format .

check:
	@echo "✅ Running full check..."
	docker-compose exec $(BACKEND_SERVICE) sh -c "ruff check . && ruff format . --check"

# ============================================================================
# UTILITIES
# ============================================================================

# Show container logs (follow mode)
logs:
	docker-compose logs -f

# Show specific service logs
logs-backend:
	docker-compose logs -f $(BACKEND_SERVICE)

logs-frontend:
	docker-compose logs -f $(FRONTEND_SERVICE)

# Open shell in backend container
shell:
	docker-compose exec $(BACKEND_SERVICE) /bin/bash

# Restart a specific service
restart:
	docker-compose restart $(BACKEND_SERVICE)

# Check container status
status:
	docker-compose ps

# ============================================================================
# GIT WORKFLOW (Optional - remove if not needed)
# ============================================================================

# Push with optional pre-push checks
push:
	@echo "📤 Pushing to remote..."
	# Add pre-push hooks here (lint, test, etc.)
	git push

# Create and push a new branch
# Usage: make branch feature/my-feature
ifeq (branch,$(firstword $(MAKECMDGOALS)))
  BRANCH_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(BRANCH_ARGS):;@:)
endif

branch:
	@if "$(BRANCH_ARGS)"=="" (echo "⚠️  Usage: make branch <name>" & exit /b 1)
	@echo "🌿 Creating branch: $(BRANCH_ARGS)"
	@git checkout -b $(BRANCH_ARGS)
	@git push --set-upstream origin $(BRANCH_ARGS)
```

---

## Template docker-compose.yml

```yaml
# [PROJECT_NAME] - Docker Compose Configuration
version: '3.8'

services:
  # ==========================================
  # Backend API Service
  # ==========================================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME:-app}-api
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    env_file:
      - .env
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD:-password}
      - DB_NAME=${DB_NAME:-app}
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_started
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ==========================================
  # PostgreSQL Database
  # ==========================================
  postgres:
    image: postgres:15-alpine
    container_name: ${PROJECT_NAME:-app}-postgres
    restart: unless-stopped
    ports:
      - "${DB_PORT:-5432}:5432"
    env_file:
      - .env
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD:-password}
      - POSTGRES_DB=${DB_NAME:-app}
      - POSTGRES_HOST_AUTH_METHOD=trust  # Dev only!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ==========================================
  # Redis (Optional - for background tasks)
  # ==========================================
  redis:
    image: redis:7-alpine
    container_name: ${PROJECT_NAME:-app}-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ==========================================
  # Frontend (Optional - React/Vue/etc.)
  # ==========================================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME:-app}-frontend
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-5173}:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules  # Preserve node_modules from container
    depends_on:
      - backend
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

---

## Template .env

```env
# [PROJECT_NAME] Environment Variables

# Project
PROJECT_NAME=myapp

# Database
DB_PASSWORD=password
DB_NAME=myapp

# Ports (optional, use defaults if not set)
BACKEND_PORT=8000
FRONTEND_PORT=5173
DB_PORT=5432
REDIS_PORT=6379

# API Keys (add as needed)
SECRET_KEY=change-me-in-production
```

---

## Customization Checklist

When applying this template to a new project:

1. [ ] Replace `[PROJECT_NAME]` placeholders with your project name
2. [ ] Update `BACKEND_SERVICE` and other service names in Makefile
3. [ ] Update ports if they conflict with other projects
4. [ ] Customize the `sync` target for your project's needs (API codegen, etc.)
5. [ ] Add/remove services in docker-compose.yml (Redis, Celery, etc.)
6. [ ] Create `.env` file from the template
7. [ ] Update healthcheck endpoints to match your API

## Example: Applying to New Project

```bash
# 1. Copy template files to new project
cp Makefile.template /path/to/new-project/Makefile
cp docker-compose.template.yml /path/to/new-project/docker-compose.yml
cp .env.template /path/to/new-project/.env

# 2. Edit files to customize for the new project
# 3. Run make setup to initialize
make setup
```
