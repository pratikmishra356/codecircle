.PHONY: help up down build logs setup dev clean status

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

dev: ## Start all services locally for development
	@echo "Starting local development servers..."
	@echo "Make sure PostgreSQL is running on localhost:5432"
	@echo ""
	@trap 'kill 0' EXIT; \
	( cd services/code-parser && source venv/bin/activate && \
	  PYTHONPATH=src uvicorn code_parser.main:app --host 0.0.0.0 --port 8000 --reload ) & \
	( cd services/metrics-explorer && source venv/bin/activate && \
	  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload ) & \
	( cd services/logs-explorer/backend && source venv/bin/activate && \
	  uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload ) & \
	( cd services/fixai/backend && source venv/bin/activate && \
	  uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload ) & \
	( cd platform && source venv/bin/activate && \
	  uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload ) & \
	( cd dashboard && npm run dev ) & \
	wait

migrate: ## Run database migrations for all services
	@echo "Running migrations..."
	cd services/code-parser && source venv/bin/activate && alembic upgrade head
	cd services/metrics-explorer && source venv/bin/activate && alembic upgrade head
	cd services/logs-explorer/backend && source venv/bin/activate && PYTHONPATH=. alembic upgrade head
