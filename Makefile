# LineSight Factory Excel Manager - Project Automation
BACKEND_VENV_PYTHON = backend\venv\Scripts\python

.PHONY: default dev run sync sync-check check check-backend check-frontend setup help clean push push-quick

# Default: List available commands
default: help

help:
	@echo ""
	@echo "  LineSight Factory Manager"
	@echo "  ========================="
	@echo ""
	@echo "  Development:"
	@echo "    make run            - Sync API types + start frontend only"
	@echo "    make dev            - Sync API types + start full stack (backend + frontend)"
	@echo ""
	@echo "  API Types:"
	@echo "    make sync           - Full API sync (extract -> lint -> generate -> typecheck)"
	@echo "    make sync-check     - Quick sync check (extract + generate, skip lint)"
	@echo ""
	@echo "  Quality Assurance:"
	@echo "    make check          - Run ALL checks (backend + frontend)"
	@echo "    make check-backend  - Run backend tests and linting"
	@echo "    make check-frontend - Run frontend type checking and linting"
	@echo ""
	@echo "  Git & Deployment:"
	@echo "    make clean          - Remove cache files (__pycache__, .pytest_cache, etc)"
	@echo "    make push m=\"msg\"   - Clean, commit with message, push to GitHub"
	@echo "    make push-quick     - Clean, commit with timestamp, push to GitHub"
	@echo ""
	@echo "  Setup:"
	@echo "    make setup          - Install all dependencies"
	@echo ""

# ============================================================================
# DEVELOPMENT COMMANDS
# ============================================================================

# Start frontend only with API sync (most common workflow)
run: sync-check
	@echo ""
	@echo "🚀 Starting Frontend..."
	cd frontend && npm run dev

# Start full stack development environment with API sync
dev: sync-check
	@echo ""
	@echo "🚀 Starting Full Stack Development Environment..."
	@echo "   Backend:  http://localhost:8000"
	@echo "   Frontend: http://localhost:5173"
	@echo ""
	start "LineSight Backend" /d backend cmd /k "venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
	@timeout /t 3 /nobreak > nul
	start "LineSight Frontend" /d frontend cmd /k "npm run dev"

# ============================================================================
# API SYNCHRONIZATION
# ============================================================================

# Full API sync pipeline (Extract -> Lint -> Generate -> TypeCheck)
# Use this before commits or when you want thorough validation
sync:
	@echo ""
	@echo "🔄 Running Full API Sync Pipeline..."
	cd frontend && npm run sync-api
	@echo ""
	@echo "✅ API sync complete! Types are up to date."

# Quick sync check - faster, skips linting (used by run/dev)
# This extracts schema and regenerates types without full lint pass
sync-check:
	@echo ""
	@echo "🔄 Syncing API types with backend..."
	@cd frontend && npm run extract-schema 2>nul || (echo "⚠️  Schema extraction failed - is backend code valid?" && exit /b 1)
	@cd frontend && npm run generate-api 2>nul || (echo "⚠️  API generation failed" && exit /b 1)
	@echo "✅ API types synchronized!"

# ============================================================================
# QUALITY ASSURANCE
# ============================================================================

# Run ALL checks (Backend + Frontend) - use before commits/PRs
check: check-backend check-frontend
	@echo ""
	@echo "✅ All checks passed!"

# Run backend tests and linting
check-backend:
	@echo ""
	@echo "🔍 Checking Backend..."
	cd backend && venv\Scripts\activate && ruff check . && pytest
	@echo "✅ Backend checks passed!"

# Run frontend type checking and linting
check-frontend:
	@echo ""
	@echo "🔍 Checking Frontend..."
	cd frontend && npm run type-check && npm run lint
	@echo "✅ Frontend checks passed!"

# ============================================================================
# SETUP
# ============================================================================

# Install all dependencies for both projects
setup:
	@echo ""
	@echo "📦 Installing Backend Dependencies..."
	cd backend && pip install -r requirements.txt
	@echo ""
	@echo "📦 Installing Frontend Dependencies..."
	cd frontend && npm install
	@echo ""
	@echo "✅ Setup complete! Run 'make dev' to start developing."

# ============================================================================
# GIT & DEPLOYMENT
# ============================================================================

# Clean up caches and generated files
clean:
	@echo ""
	@echo "🧹 Cleaning up caches and generated files..."
	@if exist "backend\__pycache__" rd /s /q "backend\__pycache__" 2>nul
	@if exist "backend\app\__pycache__" rd /s /q "backend\app\__pycache__" 2>nul
	@if exist "backend\.pytest_cache" rd /s /q "backend\.pytest_cache" 2>nul
	@if exist "backend\.ruff_cache" rd /s /q "backend\.ruff_cache" 2>nul
	@if exist "frontend\node_modules\.cache" rd /s /q "frontend\node_modules\.cache" 2>nul
	@for /d /r backend %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" 2>nul
	@echo "✅ Cleanup complete!"

# Push to GitHub with automatic commit
# Usage: make push m="Your commit message"
# If no message provided, uses a timestamp
push: clean
	@echo ""
	@echo "🚀 Preparing to push to GitHub..."
	@git add -A
	@if "$(m)"=="" ( \
		git commit -m "Update: %date% %time%" \
	) else ( \
		git commit -m "$(m)" \
	)
	@git push
	@echo ""
	@echo "✅ Successfully pushed to GitHub!"

# Quick push with default message
push-quick: clean
	@echo "🚀 Smart push to GitHub..."
	@$(BACKEND_VENV_PYTHON) scripts/autocommit.py

