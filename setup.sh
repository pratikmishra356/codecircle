#!/usr/bin/env bash
set -euo pipefail

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

# ── 1. Submodules ────────────────────────────────────────────────────
info "Updating git submodules..."
git submodule update --init --remote --recursive 2>/dev/null && ok "Submodules updated" || warn "Submodule update failed (local changes?). Continuing."

# ── 2. Env file ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    warn ".env created from .env.example — edit with your keys"
else
    ok ".env already exists"
fi

# ── 3. Read database config from .env ────────────────────────────────
read_env() { grep "^$1=" .env 2>/dev/null | cut -d= -f2- || echo ""; }

DB_USER="$(read_env DB_USER)";       DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="$(read_env DB_PASSWORD)"; DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_HOST="$(read_env DB_HOST)";       DB_HOST="${DB_HOST:-localhost}"
DB_PORT="$(read_env DB_PORT)";       DB_PORT="${DB_PORT:-5432}"
DB_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}"

info "Using database: ${DB_USER}@${DB_HOST}:${DB_PORT}"

# ── 4. Create databases ─────────────────────────────────────────────
info "Creating databases..."
export PGPASSWORD="${DB_PASSWORD}"
for db in codecircle fixai code_parser metrics_explorer logs_explorer; do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$db"; then
        ok "Database '$db' exists"
    else
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$db" 2>/dev/null && ok "Created '$db'" || warn "Could not create '$db'"
    fi
done
unset PGPASSWORD

# ── 5. Write DATABASE_URL to each service .env ──────────────────────
info "Writing service .env files..."
for entry in "platform:codecircle" "services/fixai/backend:fixai" "services/metrics-explorer:metrics_explorer" "services/logs-explorer/backend:logs_explorer" "services/code-parser:code_parser"; do
    dir="${entry%%:*}"; db="${entry##*:}"
    if [ ! -f "$dir/.env" ]; then
        echo "DATABASE_URL=${DB_URL}/$db" > "$dir/.env"
        ok "Created $dir/.env"
    else
        ok "$dir/.env exists"
    fi
done

# ── 6. Python virtual environments ──────────────────────────────────
setup_venv() {
    local dir="$1" req="${2:-requirements.txt}"
    info "Python venv: $dir"
    [ -d "$dir/venv" ] || python3 -m venv "$dir/venv"
    source "$dir/venv/bin/activate"
    pip install --quiet --upgrade pip
    if [ -f "$dir/$req" ]; then
        pip install --quiet -r "$dir/$req"
    fi
    deactivate
    ok "$dir ready"
}

setup_venv "platform"
setup_venv "services/fixai/backend"
setup_venv "services/metrics-explorer"
setup_venv "services/logs-explorer/backend"

info "Python venv: services/code-parser"
[ -d "services/code-parser/venv" ] || python3 -m venv "services/code-parser/venv"
source "services/code-parser/venv/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -e "services/code-parser"
deactivate
ok "services/code-parser ready"

# ── 7. Frontend dependencies ────────────────────────────────────────
info "Installing dashboard npm packages..."
(cd dashboard && npm install) && ok "Dashboard ready" || warn "Dashboard npm install failed"

for fe in services/code-parser/frontend services/metrics-explorer/frontend services/logs-explorer/frontend services/fixai/frontend; do
    if [ -f "$fe/package.json" ]; then
        info "npm install: $fe"
        (cd "$fe" && rm -rf node_modules && npm install) && ok "$fe ready" || warn "$fe npm install failed"
    fi
done

# ── 8. Run migrations ───────────────────────────────────────────────
info "Running database migrations..."
(cd services/code-parser && source venv/bin/activate && export DATABASE_URL="${DB_URL}/code_parser" && alembic upgrade head) && ok "code-parser migrated" || warn "code-parser migration failed"
(cd services/fixai/backend && source venv/bin/activate && export DATABASE_URL="${DB_URL}/fixai" && PYTHONPATH=. alembic upgrade head) && ok "fixai migrated" || warn "fixai migration failed"
(cd services/metrics-explorer && source venv/bin/activate && export DATABASE_URL="${DB_URL}/metrics_explorer" && alembic upgrade head) && ok "metrics-explorer migrated" || warn "metrics-explorer migration failed"
(cd services/logs-explorer/backend && source venv/bin/activate && export DATABASE_URL="${DB_URL}/logs_explorer" && PYTHONPATH=. alembic upgrade head) && ok "logs-explorer migrated" || warn "logs-explorer migration failed"

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: make dev"
echo "  3. Open: http://localhost:5173"
echo ""
