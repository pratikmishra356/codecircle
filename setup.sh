#!/usr/bin/env bash
set -euo pipefail

# ─── CodeCircle Local Development Setup ──────────────────────────────
# This script sets up all services for local development.
# Prerequisites: Python 3.11+, Node.js 18+, PostgreSQL 14+

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     CodeCircle — Development Setup       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. Git submodules (fetch from remote; if a submodule has local changes, it is left unchanged)
info "Fetching git submodules from remote..."
if git submodule update --init --remote --recursive 2>/dev/null; then
  ok "Submodules updated to latest from remote"
else
  warn "Some submodules could not be updated (local changes?). Using current state. Run 'make submodule-pull' or 'git submodule update --init --remote' later to retry."
fi

# 2. Environment file
if [ ! -f .env ]; then
    cp .env.example .env
    warn ".env created from .env.example — edit with your keys"
else
    ok ".env already exists"
fi

# 3. PostgreSQL connection from .env (PG_URL or PG_USER/PG_PASSWORD/PG_HOST/PG_PORT)
read_env() { grep "^$1=" .env 2>/dev/null | cut -d= -f2- || true; }
if [ -f .env ]; then
  PG_USER="$(read_env PG_USER)"; PG_USER="${PG_USER:-postgres}"
  PG_PASSWORD="$(read_env PG_PASSWORD)"; PG_PASSWORD="${PG_PASSWORD:-postgres}"
  PG_HOST="$(read_env PG_HOST)"; PG_HOST="${PG_HOST:-localhost}"
  PG_PORT="$(read_env PG_PORT)"; PG_PORT="${PG_PORT:-5432}"
  PG_URL="$(read_env PG_URL)"
else
  PG_USER="postgres"; PG_PASSWORD="postgres"; PG_HOST="localhost"; PG_PORT="5432"; PG_URL=""
fi
if [ -n "${PG_URL:-}" ]; then
  pg_base="${PG_URL}"
else
  pg_base="postgresql+asyncpg://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}"
fi

# 4. Service .env files (DATABASE_URL for local PostgreSQL)
info "Creating service .env files for local PostgreSQL..."
for entry in "platform:codecircle" "services/fixai/backend:fixai" "services/metrics-explorer:metrics_explorer" "services/logs-explorer/backend:logs_explorer" "services/code-parser:code_parser"; do
  dir="${entry%%:*}"
  db="${entry##*:}"
  envfile="$dir/.env"
  if [ ! -f "$envfile" ]; then
    echo "DATABASE_URL=${pg_base}/$db" > "$envfile"
    ok "Created $envfile"
  else
    ok "$envfile already exists"
  fi
done

# 5. Create databases
info "Creating PostgreSQL databases..."
export PGPASSWORD="${PG_PASSWORD}"
for db in codecircle fixai metrics_explorer logs_explorer code_parser; do
    if psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$db"; then
        ok "Database '$db' already exists"
    else
        createdb -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" "$db" 2>/dev/null && ok "Created database '$db'" || warn "Could not create '$db' — create it manually"
    fi
done
unset PGPASSWORD

# 6. Python virtual environments
setup_python_venv() {
    local dir="$1"
    local req="$2"
    info "Setting up Python venv in $dir..."
    if [ ! -d "$dir/venv" ]; then
        python3 -m venv "$dir/venv"
    fi
    source "$dir/venv/bin/activate"
    pip install --quiet --upgrade pip
    if [ -f "$dir/$req" ]; then
        pip install --quiet -r "$dir/$req"
    elif [ -f "$dir/pyproject.toml" ]; then
        pip install --quiet -e "$dir"
    fi
    deactivate
    ok "Venv ready: $dir"
}

setup_python_venv "platform" "requirements.txt"
setup_python_venv "services/fixai/backend" "requirements.txt"
setup_python_venv "services/metrics-explorer" "requirements.txt"
setup_python_venv "services/logs-explorer/backend" "requirements.txt"

# Code parser uses pyproject.toml
info "Setting up Python venv in services/code-parser..."
if [ ! -d "services/code-parser/venv" ]; then
    python3 -m venv "services/code-parser/venv"
fi
source "services/code-parser/venv/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -e "services/code-parser"
deactivate
ok "Venv ready: services/code-parser"

# 7. Frontend dependencies (dashboard + all service frontends)
info "Installing dashboard dependencies..."
cd dashboard && npm install --silent && cd ..
ok "Dashboard dependencies installed"

for svc_frontend in services/code-parser/frontend services/metrics-explorer/frontend services/logs-explorer/frontend services/fixai/frontend; do
    if [ -f "$svc_frontend/package.json" ]; then
        info "Installing $svc_frontend dependencies..."
        (cd "$svc_frontend" && npm install --silent) && ok "$svc_frontend ready" || warn "$svc_frontend install failed"
    fi
done

# 8. Run migrations
info "Running database migrations..."
(cd services/code-parser && source venv/bin/activate && alembic upgrade head 2>/dev/null) && ok "Code parser migrated" || warn "Code parser migration failed"
(cd services/fixai/backend && source venv/bin/activate && PYTHONPATH=. alembic upgrade head 2>/dev/null) && ok "FixAI migrated" || warn "FixAI migration failed"
(cd services/metrics-explorer && source venv/bin/activate && alembic upgrade head 2>/dev/null) && ok "Metrics explorer migrated" || warn "Metrics explorer migration failed"
(cd services/logs-explorer/backend && source venv/bin/activate && PYTHONPATH=. alembic upgrade head 2>/dev/null) && ok "Logs explorer migrated" || warn "Logs explorer migration failed"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup complete!                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: make dev"
echo "  3. Open: http://localhost:5173 (CodeCircle Dashboard)"
echo ""
echo "Service UIs (embedded in dashboard, also available standalone):"
echo "  Code Parser:       http://localhost:3000"
echo "  Metrics Explorer:  http://localhost:3002"
echo "  Logs Explorer:     http://localhost:3003"
echo "  FixAI:             http://localhost:3006"
echo ""
