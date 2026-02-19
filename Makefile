.PHONY: help up down build logs setup dev dev-backends clean clean-local status stop-dev migrate

SHELL := /bin/bash

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Database config from .env (with defaults) ──────────────────────

DB_USER     := $(or $(strip $(shell grep '^DB_USER=' .env 2>/dev/null | cut -d= -f2-)),postgres)
DB_PASSWORD := $(or $(strip $(shell grep '^DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2-)),postgres)
DB_HOST     := $(or $(strip $(shell grep '^DB_HOST=' .env 2>/dev/null | cut -d= -f2-)),localhost)
DB_PORT     := $(or $(strip $(shell grep '^DB_PORT=' .env 2>/dev/null | cut -d= -f2-)),5432)
DB_URL      := postgresql+asyncpg://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)

# ─── Env vars from .env ─────────────────────────────────────────────

ENCRYPTION_KEY   ?= $(shell grep '^ENCRYPTION_KEY=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_API_KEY   ?= $(shell grep '^CLAUDE_API_KEY=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_BEDROCK_URL ?= $(shell grep '^CLAUDE_BEDROCK_URL=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_MODEL_ID  ?= $(shell grep '^CLAUDE_MODEL_ID=' .env 2>/dev/null | cut -d= -f2-)

# ─── Docker ──────────────────────────────────────────────────────────

up: ## Start all services with docker-compose
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env — edit with your keys"; fi
	docker-compose up -d --build
	@echo "Dashboard: http://localhost:5173"

down: ## Stop all services
	docker-compose down

build: ## Rebuild all Docker images
	docker-compose build --no-cache

logs: ## Tail logs from all services
	docker-compose logs -f

status: ## Show service status
	docker-compose ps

clean: ## Stop services and remove volumes (deletes data)
	docker-compose down -v

clean-local: stop-dev ## Remove local dev artifacts: DBs, node_modules, venvs, service .env
	@echo "Dropping databases..."
	@export PGPASSWORD="$(DB_PASSWORD)"; \
	for db in codecircle fixai code_parser metrics_explorer logs_explorer; do \
	  dropdb -h "$(DB_HOST)" -p "$(DB_PORT)" -U "$(DB_USER)" "$$db" 2>/dev/null && echo "  Dropped $$db" || true; \
	done; unset PGPASSWORD
	@echo "Removing node_modules..."
	@rm -rf dashboard/node_modules
	@rm -rf services/code-parser/frontend/node_modules services/metrics-explorer/frontend/node_modules
	@rm -rf services/logs-explorer/frontend/node_modules services/fixai/frontend/node_modules
	@echo "Removing Python venvs..."
	@rm -rf platform/venv services/fixai/backend/venv services/metrics-explorer/venv
	@rm -rf services/logs-explorer/backend/venv services/code-parser/venv
	@echo "Removing service .env files..."
	@rm -f platform/.env services/fixai/backend/.env services/metrics-explorer/.env
	@rm -f services/logs-explorer/backend/.env services/code-parser/.env
	@echo "Removing Python cache..."
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null; true
	@find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null; true
	@echo "clean-local done. Run 'make setup' to set up again."

# ─── Local Development ───────────────────────────────────────────────

setup: ## Set up local development environment
	@bash setup.sh

ensure-dbs:
	@export PGPASSWORD="$(DB_PASSWORD)"; \
	for db in codecircle fixai code_parser metrics_explorer logs_explorer; do \
	  psql -h "$(DB_HOST)" -p "$(DB_PORT)" -U "$(DB_USER)" -tc \
	    "SELECT 1 FROM pg_database WHERE datname = '$$db'" 2>/dev/null | grep -q 1 \
	    || (createdb -h "$(DB_HOST)" -p "$(DB_PORT)" -U "$(DB_USER)" "$$db" 2>/dev/null && echo "Created $$db" || true); \
	done

stop-dev:
	@for port in 8000 8001 8003 8100 8200 3000 3002 3003 3006 5173; do \
	  pid=$$(lsof -ti :$$port 2>/dev/null); \
	  [ -n "$$pid" ] && kill -9 $$pid 2>/dev/null && echo "Stopped port $$port" || true; \
	done

migrate: ## Run database migrations for all services
	@echo "Running migrations..."
	@(cd services/code-parser && source venv/bin/activate && export DATABASE_URL="$(DB_URL)/code_parser" && alembic upgrade head) && echo "  code-parser OK" || echo "  code-parser FAILED"
	@(cd services/fixai/backend && source venv/bin/activate && export DATABASE_URL="$(DB_URL)/fixai" && PYTHONPATH=. alembic upgrade head) && echo "  fixai OK" || echo "  fixai FAILED"
	@(cd services/metrics-explorer && source venv/bin/activate && export DATABASE_URL="$(DB_URL)/metrics_explorer" && alembic upgrade head) && echo "  metrics-explorer OK" || echo "  metrics-explorer FAILED"
	@(cd services/logs-explorer/backend && source venv/bin/activate && export DATABASE_URL="$(DB_URL)/logs_explorer" && PYTHONPATH=. alembic upgrade head) && echo "  logs-explorer OK" || echo "  logs-explorer FAILED"

dev: stop-dev ensure-dbs migrate ## Start all services for local development
	@echo ""
	@echo "Backends:  8000 (code-parser)  8001 (metrics)  8003 (logs)  8100 (fixai)  8200 (platform)"
	@echo "Frontends: 3000 (code-parser)  3002 (metrics)  3003 (logs)  3006 (fixai)  5173 (dashboard)"
	@echo ""
	@trap 'kill 0' EXIT; \
	( cd services/code-parser && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/code_parser" PYTHONPATH=src \
	  uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd services/metrics-explorer && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd services/logs-explorer/backend && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/logs_explorer" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd services/fixai/backend && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/fixai" \
	  CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/codecircle" ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	  CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd services/code-parser/frontend && npx vite --port 3000 ) & \
	( cd services/metrics-explorer/frontend && VITE_API_BASE_URL=http://localhost:8001 npx vite --port 3002 ) & \
	( cd services/logs-explorer/frontend && npx vite --port 3003 ) & \
	( cd services/fixai/frontend && npx vite --port 3006 ) & \
	( cd dashboard && npm run dev ) & \
	wait

dev-backends: stop-dev ensure-dbs migrate ## Start only backend services + dashboard
	@trap 'kill 0' EXIT; \
	( cd services/code-parser && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/code_parser" PYTHONPATH=src \
	  uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd services/metrics-explorer && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd services/logs-explorer/backend && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/logs_explorer" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd services/fixai/backend && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/fixai" \
	  CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  DATABASE_URL="$(DB_URL)/codecircle" ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	  CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)" \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd dashboard && npm run dev ) & \
	wait
