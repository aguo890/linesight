# LineSight Factory Excel Manager - Project Automation

# Variables
COMPOSE_FILE := docker-compose.yml
# Default service for shell command
SERVICE ?= backend
# Use backend venv python if available, otherwise fall back to system python
# This ensures utility scripts (push, reconcile, etc.) have all dependencies
ifeq ($(OS),Windows_NT)
    ifneq (,$(wildcard backend/venv/Scripts/python.exe))
        PYTHON_CMD := backend/venv/Scripts/python.exe
    else
        PYTHON_CMD := python
    endif
else
    ifneq (,$(wildcard backend/venv/bin/python))
        PYTHON_CMD := backend/venv/bin/python
    else
        PYTHON_CMD := $(shell command -v python > /dev/null 2>&1 && echo python || echo python3)
    endif
endif

.PHONY: default dev up down restart logs shell clean setup help push push-quick migrate branch reconcile reconcile-dry sync-check test test-cov lint lint-fix format check

# Default: List available commands
default: help

help:
	@echo ""
	@echo "  LineSight Factory Manager"
	@echo "  ========================="
	@echo ""
	@echo "  Primary Commands:"
	@echo "    make up       : Start the app in background (detached)"
	@echo "    make down     : Stop the app"
	@echo "    make logs     : Tail logs (Ctrl+C to exit)"
	@echo "    make shell    : Enter container shell (default: backend)"
	@echo "    make clean    : Deep clean (removes data/images)"
	@echo "    make dev      : Start up + Follow logs (Legacy/Convenience)"
	@echo "    make reset-backend : Recreate and migrate backend"
	@echo "    make restart-backend: Restart backend container"
	@echo ""
	@echo "  Project Workflows:"
	@echo "    make setup    : FRESH START (Down, Build, Up, Migrate)"
	@echo "    make migrate  : Generate new Alembic migration"
	@echo "    make reconcile: Sync PROJECT_BOARD.md with Git"
	@echo "    make push     : Reconcile + Push"
	@echo ""

# ==========================================
# Core Lifecycle (Intent-Based)
# ==========================================

.PHONY: up
# We use --remove-orphans to keep the network clean
up:
	@echo "🚀 Starting services in background..."
	@$(PYTHON_CMD) scripts/utils.py kill_port 8000 || echo "⚠️ Port 8000 cleanup skipped..."
	@$(PYTHON_CMD) scripts/utils.py kill_port 5173 || echo "⚠️ Port 5173 cleanup skipped..."
	docker compose up -d --build --remove-orphans
	@echo "✅ App is running in background. Run 'make logs' to watch."

.PHONY: down
down:
	@echo "🛑 Stopping services..."
	docker compose down

.PHONY: restart
restart: down up

.PHONY: restart-backend
restart-backend:
	docker compose restart backend

.PHONY: reset-backend
reset-backend:
	@echo "🔄 Resetting backend service..."
	docker compose stop backend
	docker compose rm -f backend
	docker compose up -d backend
	@echo "⏳ Waiting for DB..."
	@docker compose exec backend python wait_for_db.py
	@echo "🔄 Running migrations..."
	docker compose exec backend alembic upgrade head
	@echo "✅ Backend reset complete."

# ==========================================
# Interaction & Debugging
# ==========================================

# -f follows the log output
.PHONY: logs
logs:
	docker compose logs -f

# Allows passing specific service, e.g., 'make shell SERVICE=postgres'
.PHONY: shell
shell:
	@echo "🐚 Entering shell for $(SERVICE)..."
	docker compose exec $(SERVICE) /bin/bash

# ==========================================
# Maintenance
# ==========================================

# -v removes volumes, --rmi local removes images built locally
.PHONY: clean
clean:
	@$(PYTHON_CMD) scripts/utils.py clean_confirm
	docker compose down -v --rmi local
	@echo "✨ Environment cleaned."

# ==========================================
# Workflows / Wrappers
# ==========================================

# 1. Dev - "Daily Driver"
# Starts app -> Syncs API types -> Tails logs
dev: up wait-healthy sync-check logs

# 1b. Dev-Local - Native dev without Docker
# Starts Postgres, Redis, Backend, Frontend with combined logs in one terminal
.PHONY: dev-local stop-local
dev-local:
	@powershell -ExecutionPolicy Bypass -File dev_local.ps1

stop-local:
	@powershell -ExecutionPolicy Bypass -File stop_native.ps1

# 2. Setup - The "Fresh Start" command
# Stops everything, removes volumes (cleans DB), rebuilds, starts, and migrates.
setup:
	@echo ""
	@echo "🛑 Stopping containers and removing volumes..."
	docker compose down -v
	@echo ""
	@echo "🏗️  Building containers..."
	docker compose build
	@echo ""
	@echo "🚀 Starting services..."
	docker compose up -d
	@echo ""
	@echo "⏳ Waiting for Postgres to be ready (30s max)..."
	@docker compose exec backend python wait_for_db.py
	@echo ""
	@echo "🔄 Running migrations..."
	docker compose exec backend alembic upgrade head
	@echo ""
	@echo "✅ Setup complete! App is running at http://localhost:5173"

# 3. Migrate - Generate new migrations
migrate:
	@echo ""
	@echo "🐘 Generating Migration..."
	docker compose exec backend alembic revision --autogenerate -m "auto_migration"
	@echo "✅ Migration created! Check backend/alembic/versions"

# 4. Seed - Populate Database
seed:
	@echo "🌱 Seeding database (in Docker)..."
	docker compose exec backend python seed_cli.py

# ==========================================
# PROJECT MANAGEMENT
# ==========================================

# V2 Code-First Reconciliation
reconcile:
	@echo ""
	@echo "🔍 Running V2 Code-First Reconciliation..."
	@$(PYTHON_CMD) scripts/reconcile/reconcile_board.py --days 14
	@echo ""

# Dry-run reconciliation
reconcile-dry:
	@echo ""
	@echo "🔍 Running Reconciliation (Dry Run)..."
	@$(PYTHON_CMD) scripts/reconcile/reconcile_board.py --days 14 --dry-run
	@echo ""

# Push to GitHub
push: ## 🛡️ Auto-commit + Push
	@echo ""
	@echo "🚀 Running smart push..."
	@$(PYTHON_CMD) scripts/autocommit.py

# Quick push
push-quick:
	@echo "⚡ Quick push (skipping reconciliation)..."
	@$(PYTHON_CMD) scripts/autocommit.py

# Create a new branch
ifeq (branch,$(firstword $(MAKECMDGOALS)))
  BRANCH_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(BRANCH_ARGS):;@:)
endif

branch:
	@$(PYTHON_CMD) scripts/utils.py branch $(BRANCH_ARGS)

# ==========================================
# LEGACY & UTILITY COMMANDS
# ==========================================

# Waits until API is actually responding (not just port open)
wait-healthy:
	@$(PYTHON_CMD) scripts/utils.py wait_http http://localhost:8000/api/v1/openapi.json

sync-check:
	@echo "🔄 Syncing API types..."
	@cd frontend && npm run extract-schema || (echo "⚠️ Schema failed" && exit 1)
	@cd frontend && npm run generate-api
	@echo "✅ Types synced."

test:
	@echo "🧪 Running Tests (in Docker against PostgreSQL)..."
	docker compose exec \
	  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/linesight_test \
	  backend pytest tests/

test-cov:
	@echo "📊 Running Tests with Coverage (in Docker against PostgreSQL)..."
	docker compose exec \
	  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/linesight_test \
	  backend pytest --cov=app --cov-report=term-missing

lint:
	@echo "🎨 Linting (in Docker)..."
	docker compose exec backend ruff check .

lint-fix:
	@echo "🔧 Fixing Lint Errors (in Docker)..."
	docker compose exec backend ruff check . --fix

format:
	@echo "✨ Formatting Code (in Docker)..."
	docker compose exec backend ruff format .

check:
	@echo "✅ Running Full Check (in Docker)..."
	docker compose exec backend sh -c "ruff check . && ruff format . --check && mypy app"
