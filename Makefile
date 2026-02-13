.PHONY: help up down build logs setup dev clean status ensure-dbs

# ─── Defaults ────────────────────────────────────────────────────────
SHELL := /bin/bash

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Docker Commands ─────────────────────────────────────────────────

up: ## Start all services with docker-compose
	@echo "Starting CodeCircle..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example — edit with your keys"; fi
	docker-compose up -d --build
	@echo ""
	@echo "CodeCircle is starting up..."
	@echo "  Dashboard:        http://localhost:5173"
	@echo "  Platform API:     http://localhost:8200/docs"
	@echo "  FixAI API:        http://localhost:8100/docs"
	@echo "  Metrics Explorer: http://localhost:8001/docs"
	@echo "  Logs Explorer:    http://localhost:8003/docs"
	@echo "  Code Parser:      http://localhost:8000/docs"

down: ## Stop all services
	docker-compose down

build: ## Rebuild all Docker images
	docker-compose build --no-cache

logs: ## Tail logs from all services
	docker-compose logs -f

logs-%: ## Tail logs for a specific service (e.g., make logs-fixai)
	docker-compose logs -f $*

status: ## Show service status
	docker-compose ps

clean: ## Stop services and remove volumes (WARNING: deletes data)
	docker-compose down -v
	@echo "All data removed."

# ─── Local Development ───────────────────────────────────────────────

setup: ## Set up local development environment
	@bash setup.sh

# Local PostgreSQL URL (override in env if needed)
PG_URL ?= postgresql+asyncpg://postgres:postgres@localhost:5432

# Load ENCRYPTION_KEY from .env if present (needed by metrics-explorer)
ENCRYPTION_KEY ?= $(shell grep '^ENCRYPTION_KEY=' .env 2>/dev/null | cut -d= -f2-)
# Load FixAI env vars from .env if present
CLAUDE_API_KEY ?= $(shell grep '^CLAUDE_API_KEY=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_BEDROCK_URL ?= $(shell grep '^CLAUDE_BEDROCK_URL=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_MODEL_ID ?= $(shell grep '^CLAUDE_MODEL_ID=' .env 2>/dev/null | cut -d= -f2-)

# Ensure PostgreSQL databases exist (create if missing; idempotent)
ensure-dbs:
	@for db in codecircle fixai code_parser metrics_explorer logs_explorer; do \
	  PGDATABASE=postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$$db'" | grep -q 1 || (createdb -U postgres "$$db" 2>/dev/null && echo "Created database $$db" || true); \
	done

dev: ensure-dbs migrate ## Start all backends + all frontends locally for development
	@echo "Starting local development servers..."
	@echo "Make sure PostgreSQL is running on localhost:5432"
	@echo ""
	@echo "Backends:"
	@echo "  Code Parser:       http://localhost:8000"
	@echo "  Metrics Explorer:  http://localhost:8001"
	@echo "  Logs Explorer:     http://localhost:8003"
	@echo "  FixAI:             http://localhost:8100"
	@echo "  Platform:          http://localhost:8200"
	@echo ""
	@echo "Frontends:"
	@echo "  Code Parser UI:    http://localhost:3000"
	@echo "  Metrics UI:        http://localhost:3002"
	@echo "  Logs UI:           http://localhost:3003"
	@echo "  FixAI UI:          http://localhost:3006"
	@echo "  Dashboard:         http://localhost:5173"
	@echo ""
	@trap 'kill 0' EXIT; \
	( cd services/code-parser && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/code_parser" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  PYTHONPATH=src uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd services/metrics-explorer && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd services/logs-explorer/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/logs_explorer"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd services/fixai/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/fixai" CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/codecircle" ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd services/code-parser/frontend && npm run dev ) & \
	( cd services/metrics-explorer/frontend && VITE_API_BASE_URL=http://localhost:8001 npm run dev ) & \
	( cd services/logs-explorer/frontend && npm run dev ) & \
	( cd services/fixai/frontend && npm run dev ) & \
	( cd dashboard && npm run dev ) & \
	wait

dev-backends: ensure-dbs ## Start only backend services (no frontends)
	@echo "Starting backend services only..."
	@trap 'kill 0' EXIT; \
	( cd services/code-parser && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/code_parser" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  PYTHONPATH=src uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd services/metrics-explorer && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd services/logs-explorer/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/logs_explorer"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd services/fixai/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/fixai" CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/codecircle" ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd dashboard && npm run dev ) & \
	wait

migrate: ## Run database migrations for all services (idempotent)
	@echo "Running migrations..."
	@(cd services/code-parser && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/code_parser" && alembic upgrade head) && echo "  code-parser OK" || echo "  code-parser failed"
	@(cd services/metrics-explorer && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/metrics_explorer" && alembic upgrade head) && echo "  metrics-explorer OK" || echo "  metrics-explorer failed"
	@(cd services/logs-explorer/backend && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/logs_explorer" && PYTHONPATH=. alembic upgrade head) && echo "  logs-explorer OK" || echo "  logs-explorer failed"
