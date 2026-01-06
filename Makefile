# LineSight Factory Excel Manager - Project Automation

.PHONY: default dev run sync sync-check check check-backend check-frontend setup help

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
