.PHONY: help up down build logs setup dev clean status ensure-dbs stop-dev submodule-pull

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

# Pull latest in-repo submodules from their remotes (runs automatically before make dev).
# If a submodule has local/untracked changes, that one is skipped; make dev still continues.
submodule-pull:
	@echo "Fetching and updating submodules to latest from remote..."
	@-git submodule update --init --remote --recursive || true
	@echo "Submodules updated (any with local changes were left unchanged)."

# Local PostgreSQL URL (override in env if needed)
PG_URL ?= postgresql+asyncpg://postgres:postgres@localhost:5432

# Load ENCRYPTION_KEY from .env if present (needed by metrics-explorer)
ENCRYPTION_KEY ?= $(shell grep '^ENCRYPTION_KEY=' .env 2>/dev/null | cut -d= -f2-)
# Load FixAI env vars from .env if present
CLAUDE_API_KEY ?= $(shell grep '^CLAUDE_API_KEY=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_BEDROCK_URL ?= $(shell grep '^CLAUDE_BEDROCK_URL=' .env 2>/dev/null | cut -d= -f2-)
CLAUDE_MODEL_ID ?= $(shell grep '^CLAUDE_MODEL_ID=' .env 2>/dev/null | cut -d= -f2-)

# Optional: use service code from a local directory (e.g. LOCAL_SERVICES_ROOT=/Users/pratik.mishra in .env)
LOCAL_SERVICES_ROOT ?= $(strip $(shell grep '^LOCAL_SERVICES_ROOT=' .env 2>/dev/null | cut -d= -f2-))
SERVICES_ROOT := $(if $(LOCAL_SERVICES_ROOT),$(LOCAL_SERVICES_ROOT),$(CURDIR)/services)
# Per-service roots: fall back to in-repo if local has no venv/node_modules
CP_ROOT := $(if $(wildcard $(SERVICES_ROOT)/code-parser/venv/bin/activate),$(SERVICES_ROOT)/code-parser,$(CURDIR)/services/code-parser)
ME_ROOT := $(if $(wildcard $(SERVICES_ROOT)/metrics-explorer/venv/bin/activate),$(SERVICES_ROOT)/metrics-explorer,$(CURDIR)/services/metrics-explorer)
LE_ROOT := $(if $(wildcard $(SERVICES_ROOT)/logs-explorer/backend/venv/bin/activate),$(SERVICES_ROOT)/logs-explorer,$(CURDIR)/services/logs-explorer)
FX_ROOT := $(if $(wildcard $(SERVICES_ROOT)/fixai/backend/venv/bin/activate),$(SERVICES_ROOT)/fixai,$(CURDIR)/services/fixai)
CP_FE := $(if $(wildcard $(CP_ROOT)/frontend/node_modules/vite/package.json),$(CP_ROOT)/frontend,$(CURDIR)/services/code-parser/frontend)
ME_FE := $(if $(wildcard $(ME_ROOT)/frontend/node_modules/vite/package.json),$(ME_ROOT)/frontend,$(CURDIR)/services/metrics-explorer/frontend)
LE_FE := $(if $(wildcard $(LE_ROOT)/frontend/node_modules/vite/package.json),$(LE_ROOT)/frontend,$(CURDIR)/services/logs-explorer/frontend)
FX_FE := $(if $(wildcard $(FX_ROOT)/frontend/node_modules/vite/package.json),$(FX_ROOT)/frontend,$(CURDIR)/services/fixai/frontend)

# Ensure PostgreSQL databases exist (create if missing; idempotent)
ensure-dbs:
	@for db in codecircle fixai code_parser metrics_explorer logs_explorer; do \
	  PGDATABASE=postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$$db'" | grep -q 1 || (createdb -U postgres "$$db" 2>/dev/null && echo "Created database $$db" || true); \
	done

# Kill any processes already using CodeCircle dev ports (so make dev can restart cleanly)
stop-dev:
	@for port in 8000 8001 8003 8100 8200 3000 3002 3003 3006 5173; do \
	  pid=$$(lsof -ti :$$port 2>/dev/null); \
	  if [ -n "$$pid" ]; then kill -9 $$pid 2>/dev/null && echo "Stopped process on port $$port" || true; fi; \
	done

dev: submodule-pull stop-dev ensure-dbs migrate ## Start all backends + all frontends locally for development
	@echo "Starting local development servers..."
	@echo "Make sure PostgreSQL is running on localhost:5432"
	@if [ -n "$(LOCAL_SERVICES_ROOT)" ]; then echo "Using local services from: $(LOCAL_SERVICES_ROOT)"; fi
	@echo "Code Parser:  $(CP_ROOT)  |  frontend: $(CP_FE)"
	@echo "FixAI:        $(FX_ROOT)  |  frontend: $(FX_FE)"
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
	( cd $(CP_ROOT) && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/code_parser" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  PYTHONPATH=src uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd $(ME_ROOT) && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd $(LE_ROOT)/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/logs_explorer"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd $(FX_ROOT)/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/fixai" CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/codecircle" ENCRYPTION_KEY="$(ENCRYPTION_KEY)" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd $(CP_FE) && npx vite --port 3000 ) & \
	( cd $(ME_FE) && VITE_API_BASE_URL=http://localhost:8001 npx vite --port 3002 ) & \
	( cd $(LE_FE) && npx vite --port 3003 ) & \
	( cd $(FX_FE) && npx vite --port 3006 ) & \
	( cd dashboard && npm run dev ) & \
	wait

dev-backends: stop-dev ensure-dbs ## Start only backend services (no frontends)
	@echo "Starting backend services only..."
	@trap 'kill 0' EXIT; \
	( cd $(CP_ROOT) && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/code_parser" \
	         CLAUDE_API_KEY="$(CLAUDE_API_KEY)" CLAUDE_BEDROCK_URL="$(CLAUDE_BEDROCK_URL)" CLAUDE_MODEL_ID="$(CLAUDE_MODEL_ID)"; \
	  PYTHONPATH=src uvicorn code_parser.api.app:create_app --factory --host 0.0.0.0 --port 8000 --reload ) & \
	( cd $(ME_ROOT) && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/metrics_explorer" PORT=8001 ENCRYPTION_KEY="$(ENCRYPTION_KEY)"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd $(LE_ROOT)/backend && source venv/bin/activate && \
	  export DATABASE_URL="$(PG_URL)/logs_explorer"; \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd $(FX_ROOT)/backend && source venv/bin/activate && \
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
	@(cd $(CP_ROOT) && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/code_parser" && alembic upgrade head) && echo "  code-parser OK" || echo "  code-parser failed"
	@(cd $(FX_ROOT)/backend && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/fixai" && PYTHONPATH=. alembic upgrade head) && echo "  fixai OK" || echo "  fixai failed"
	@(cd $(ME_ROOT) && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/metrics_explorer" && alembic upgrade head) && echo "  metrics-explorer OK" || echo "  metrics-explorer failed"
	@(cd $(LE_ROOT)/backend && source venv/bin/activate && export DATABASE_URL="$(PG_URL)/logs_explorer" && PYTHONPATH=. alembic upgrade head) && echo "  logs-explorer OK" || echo "  logs-explorer failed"
