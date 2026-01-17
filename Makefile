# LineSight Factory Excel Manager - Project Automation
BACKEND_VENV_PYTHON = backend\venv\Scripts\python
COMPOSE_FILE := docker-compose.yml
SERVICE_NAME := backend

.PHONY: default dev run sync sync-check check check-backend check-frontend setup help clean push push-quick migrate branch reconcile reconcile-dry

# Default: List available commands
default: help

help:
	@echo ""
	@echo "  LineSight Factory Manager"
	@echo "  ========================="
	@echo ""
	@echo "  Key Workflows:"
	@echo "    make setup          - FRESH START: Down, Build, Up, Migrate (Data Loss!)"
	@echo "    make dev            - Daily startup (Docker up + Frontend sync)"
	@echo "    make migrate        - Generate new Alembic migration (auto)"
	@echo "    make reconcile      - Sync PROJECT_BOARD.md with Git (DeepSeek)"
	@echo ""
	@echo "  Legacy/Dev:"
	@echo "    make run            - Frontend only"
	@echo "    make check          - Run items"
	@echo ""

# ============================================================================
# CORE WORKFLOWS (DOCKER FIRST)
# ============================================================================

# 1. Setup - The "Fresh Start" command
# Stops everything, removes volumes (cleans DB), rebuilds, starts, and migrates.
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
	@echo "⏳ Waiting for Postgres to be ready (5s)..."
	@timeout /t 5 /nobreak > nul
	@echo ""
	@echo "🔄 Running migrations..."
	docker-compose exec $(SERVICE_NAME) alembic upgrade head
	@echo ""
	@echo "✅ Setup complete! App is running at http://localhost:5173"

# 2. Dev - Standard daily workflow
# Starts containers, syncs API types, then shows logs
dev:
	@echo ""
	@echo "🚀 Starting Docker Containers..."
	docker-compose up -d
	@echo ""
	@echo "⏳ Waiting for API to be ready (3s)..."
	@timeout /t 3 /nobreak > nul
	@$(MAKE) sync-check
	@echo ""
	@echo "   Backend:  http://localhost:8000"
	@echo "   Frontend: http://localhost:5173"
	@echo ""
	@echo "📝 Showing logs (press Ctrl+C to exit logs, containers keep running)..."
	docker-compose logs -f backend frontend

# 3. Migrate - Generate new migrations
migrate:
	@echo ""
	@echo "🐘 Generating Migration..."
	@docker-compose exec $(SERVICE_NAME) alembic revision --autogenerate -m "auto_migration"
	@echo "✅ Migration created! Check backend/alembic/versions"

# 4. Clean - Deep clean
clean:
	@echo ""
	@echo "🧹 Deep cleaning..."
	docker-compose down -v
	@echo "✅ Environment cleaned."

# 5. Seed - Populate Database
seed:
	@echo "🌱 Seeding database (in Docker)..."
	docker-compose exec $(SERVICE_NAME) python seed_cli.py

# ============================================================================
# LEGACY & UTILITY COMMANDS (Kept for compatibility)
# ============================================================================

# 5. Testing & Quality
test:
	@echo "🧪 Running Tests (in Docker)..."
	docker-compose exec $(SERVICE_NAME) pytest

test-cov:
	@echo "📊 Running Tests with Coverage (in Docker)..."
	docker-compose exec $(SERVICE_NAME) pytest --cov=app --cov-report=term-missing

lint:
	@echo "🎨 Linting (in Docker)..."
	docker-compose exec $(SERVICE_NAME) ruff check .

lint-fix:
	@echo "🔧 Fixing Lint Errors (in Docker)..."
	docker-compose exec $(SERVICE_NAME) ruff check . --fix

format:
	@echo "✨ Formatting Code (in Docker)..."
	docker-compose exec $(SERVICE_NAME) ruff format .

check:
	@echo "✅ Running Full Check (in Docker)..."
	docker-compose exec $(SERVICE_NAME) sh -c "ruff check . && ruff format . --check && mypy app"

run: sync-check
	cd frontend && npm run dev

sync-check:
	@echo "🔄 Syncing API types..."
	@cd frontend && npm run extract-schema 2>nul || (echo "⚠️ Schema failed" && exit /b 1)
	@cd frontend && npm run generate-api 2>nul
	@echo "✅ Types synced."

# Push to GitHub - Reconciles board first to prevent drift
push: reconcile-dry ## 🛡️ Reconcile board, then push (Prevents Ghost Work)
	@echo ""
	@echo "✅ Board verified. Running smart push..."
	@$(BACKEND_VENV_PYTHON) scripts/autocommit.py

# Quick push - Skip reconciliation (use sparingly!)
push-quick:
	@echo "⚡ Quick push (skipping reconciliation)..."
	@$(BACKEND_VENV_PYTHON) scripts/autocommit.py

# Create a new branch
ifeq (branch,$(firstword $(MAKECMDGOALS)))
  BRANCH_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(BRANCH_ARGS):;@:)
endif

branch:
	@if "$(BRANCH_ARGS)"=="" (echo "⚠️  Usage: make branch <name>" & exit /b 1)
	@echo "🌿 Creating branch: $(BRANCH_ARGS)"
	@git checkout -b $(BRANCH_ARGS)
	@git push --set-upstream origin $(BRANCH_ARGS)

# ============================================================================
# PROJECT MANAGEMENT
# ============================================================================

# V2 Code-First Reconciliation - Verifies board against ACTUAL code, not just commits
reconcile:
	@echo ""
	@echo "🔍 Running V2 Code-First Reconciliation..."
	@echo "   (Commits are claims, code is truth)"
	@$(BACKEND_VENV_PYTHON) scripts/reconcile/reconcile_board.py --days 14
	@echo ""

# Dry-run reconciliation (report only, no changes)
reconcile-dry:
	@echo ""
	@echo "🔍 Running Reconciliation (Dry Run)..."
	@$(BACKEND_VENV_PYTHON) scripts/reconcile/reconcile_board.py --days 14 --dry-run
	@echo ""
