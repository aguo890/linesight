# =============================================================================
# QOL MAKEFILE TEMPLATE - Git Workflow Automation
# =============================================================================
# Copy this Makefile and scripts/ folder to any project for quick setup.
#
# Prerequisites:
#   - Python 3.9+ with venv at `backend/venv` OR modify PYTHON path
#   - pip install openai python-dotenv
#   - DEEPSEEK_API_KEY in .env file (for AI commit messages)
#
# Usage:
#   make push        - Stage all, generate AI commit message, push
#   make push-quick  - Stage all, use fallback message, push
#   make branch foo  - Create 'foo' branch and push with upstream tracking
# =============================================================================

# --- Configuration ---
# Adjust this path to your Python interpreter
PYTHON = python
# Or if using a venv:
# PYTHON = backend\venv\Scripts\python  # Windows
# PYTHON = backend/venv/bin/python      # Linux/macOS

.PHONY: push push-quick branch help

# Default target
default: help

help:
	@echo ""
	@echo "  QOL Git Workflow Commands"
	@echo "  ========================="
	@echo ""
	@echo "  make push        - AI-powered commit & push (DeepSeek)"
	@echo "  make push-quick  - Quick commit & push (no AI)"
	@echo "  make branch NAME - Create and push new branch"
	@echo ""

# =============================================================================
# GIT WORKFLOW COMMANDS
# =============================================================================

# Push to GitHub with AI-generated commit message
push:
	@echo ""
	@echo "🚀 Smart push with AI commit message..."
	@$(PYTHON) scripts/autocommit.py

# Quick push - Skip AI analysis (use when DeepSeek is slow/unavailable)
push-quick:
	@echo "⚡ Quick push..."
	@$(PYTHON) scripts/autocommit.py --quick

# Create a new branch and push with upstream tracking
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
	@echo "✅ Branch '$(BRANCH_ARGS)' created and pushed!"
