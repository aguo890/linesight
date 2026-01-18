# LineSight Backend - Robust Development Commands
# Activate venv before running Python commands

# Windows venv activation prefix
VENV = venv\Scripts\activate &&

.PHONY: default dev dev-preflight dev-quick test test-cov test-file test-x migrate migration migrate-history migrate-down
.PHONY: lint lint-fix format format-check check fix typecheck seed reset-db openapi clean kill-zombies

# Default command - show available recipes
default:
	@echo "Available commands:"
	@echo "  make dev             - Run server (Auto-kills old processes first)"
	@echo "  make seed            - Seed DB directly (No server needed)"
	@echo "  make reset-db        - Drop, Migrate, and Seed (The Nuclear Option)"
	@echo "  make test            - Run all tests"
	@echo "  make lint            - Check code style"
	@echo "  make clean           - Remove cache files"

# -------------------------------------------------------------------------
# DEVELOPMENT SERVER
# -------------------------------------------------------------------------

# Run development server (Auto-kills zombies first)
dev: kill-zombies dev-preflight
	$(VENV) uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Pre-flight checks
dev-preflight:
	@echo "🔍 Running pre-flight checks..."
	@if not exist venv\Scripts\activate (echo ❌ venv not found. Run: python -m venv venv && exit /b 1)
	@if not exist .env (echo ⚠️  Warning: .env file not found)
	@echo "📦 Ensuring database is up to date..."
	-$(VENV) alembic upgrade head
	@echo "✅ Pre-flight complete!"

# Quick dev - skip checks/kills
dev-quick:
	$(VENV) uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Force kill any process on port 8000 (The Zombie Killer)
kill-zombies:
	@echo "🔫 Hunting zombies on port 8000..."
	@-for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING" 2^>nul ^|^| echo.') do if not "%%a"=="" taskkill /f /pid %%a >nul 2>&1
	@echo "✅ Port 8000 is clean."

# -------------------------------------------------------------------------
# DATABASE OPERATIONS (DEPRECATED - Use Docker Root Makefile)
# -------------------------------------------------------------------------

# NOTE: Database operations have been moved to the root Makefile 
# to run inside Docker (PostgreSQL). Do not run DB commands locally.

# -------------------------------------------------------------------------

# -------------------------------------------------------------------------
# TESTING & QUALITY
# -------------------------------------------------------------------------

test:
	$(VENV) pytest

test-cov:
	$(VENV) pytest --cov=app --cov-report=html

test-file:
	$(VENV) pytest $(FILE) -v

test-x:
	$(VENV) pytest -x

lint:
	$(VENV) ruff check .

lint-fix:
	$(VENV) ruff check . --fix

format:
	$(VENV) ruff format .

check:
	$(VENV) ruff check . && ruff format . --check

fix:
	$(VENV) ruff check . --fix && ruff format .

typecheck:
	$(VENV) mypy app

# -------------------------------------------------------------------------
# UTILS
# -------------------------------------------------------------------------

openapi:
	$(VENV) python scripts/extract_openapi.py

clean:
	@if exist __pycache__ rd /s /q __pycache__
	@if exist .pytest_cache rd /s /q .pytest_cache
	@if exist .ruff_cache rd /s /q .ruff_cache
	@for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
