# LineSight Backend - Common Development Commands
# Activate venv before running Python commands

# Windows venv activation prefix
VENV = venv\Scripts\activate &&

.PHONY: default dev dev-preflight dev-quick test test-cov test-file test-x migrate migration migrate-history migrate-down
.PHONY: lint lint-fix format format-check check fix typecheck seed reset-db openapi clean

# Default command - show available recipes
default:
	@echo "Available commands:"
	@echo "  make dev             - Run development server with hot reload"
	@echo "  make test            - Run all tests"
	@echo "  make test-cov        - Run tests with coverage"
	@echo "  make test-file FILE= - Run a specific test file"
	@echo "  make test-x          - Run tests and stop on first failure"
	@echo "  make migrate         - Apply database migrations"
	@echo "  make migration MSG=  - Create a new migration"
	@echo "  make migrate-history - Show migration history"
	@echo "  make migrate-down    - Rollback last migration"
	@echo "  make lint            - Lint code with Ruff"
	@echo "  make lint-fix        - Lint and auto-fix issues"
	@echo "  make format          - Format code with Ruff"
	@echo "  make format-check    - Check formatting without changes"
	@echo "  make check           - Run both lint and format checks"
	@echo "  make fix             - Fix all lint and format issues"
	@echo "  make typecheck       - Type check with mypy"
	@echo "  make seed            - Seed the database with test data"
	@echo "  make openapi         - Generate OpenAPI schema"
	@echo "  make clean           - Clean up cached files"

# Run development server with pre-flight checks
dev: dev-preflight
	$(VENV) uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Pre-flight checks before starting dev server
dev-preflight:
	@echo "🔍 Running pre-flight checks..."
	@if not exist venv\Scripts\activate (echo ❌ venv not found. Run: python -m venv venv && exit /b 1)
	@if not exist .env (echo ⚠️  Warning: .env file not found)
	@echo "📦 Ensuring database is up to date..."
	-$(VENV) alembic upgrade head
	@echo "✅ Pre-flight complete!"

# Quick dev - skip checks for faster startup
dev-quick:
	$(VENV) uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run all tests
test:
	$(VENV) pytest

# Run tests with coverage
test-cov:
	$(VENV) pytest --cov=app --cov-report=html

# Run a specific test file (usage: make test-file FILE=path/to/test.py)
test-file:
	$(VENV) pytest $(FILE) -v

# Run tests and stop on first failure
test-x:
	$(VENV) pytest -x

# Apply database migrations
migrate:
	$(VENV) alembic upgrade head

# Create a new migration (usage: make migration MSG="your message")
migration:
	$(VENV) alembic revision --autogenerate -m "$(MSG)"

# Show migration history
migrate-history:
	$(VENV) alembic history

# Rollback last migration
migrate-down:
	$(VENV) alembic downgrade -1

# Lint code with Ruff
lint:
	$(VENV) ruff check .

# Lint and auto-fix issues
lint-fix:
	$(VENV) ruff check . --fix

# Format code with Ruff
format:
	$(VENV) ruff format .

# Check formatting without changes
format-check:
	$(VENV) ruff format . --check

# Run both lint and format checks
check:
	$(VENV) ruff check . && ruff format . --check

# Fix all lint and format issues
fix:
	$(VENV) ruff check . --fix && ruff format .

# Type check with mypy
typecheck:
	$(VENV) mypy app

# Seed the database with test data (calls dev API)
seed:
	curl -X POST http://127.0.0.1:8000/api/v1/dev/seed

# Reset database: drop all tables, migrate, and seed (avoids FK constraint issues)
reset-db:
	@echo "🔄 Resetting database..."
	@echo "Dropping all tables..."
	mysql -u root -proot -P 3307 -e "SET FOREIGN_KEY_CHECKS = 0; DROP DATABASE IF EXISTS linesight; CREATE DATABASE linesight; SET FOREIGN_KEY_CHECKS = 1;"
	@echo "Running migrations..."
	$(VENV) alembic upgrade head
	@echo "Seeding data..."
	curl -X POST http://127.0.0.1:8000/api/v1/dev/seed
	@echo ""
	@echo "✅ Database reset complete!"

# Generate OpenAPI schema
openapi:
	$(VENV) python scripts/extract_openapi.py

# Clean up cached files (Windows compatible)
clean:
	@if exist __pycache__ rd /s /q __pycache__
	@if exist .pytest_cache rd /s /q .pytest_cache
	@if exist .ruff_cache rd /s /q .ruff_cache
	@for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
