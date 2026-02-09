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

# 1. Git submodules
info "Updating git submodules..."
git submodule update --init --recursive
ok "Submodules updated"

# 2. Environment file
if [ ! -f .env ]; then
    cp .env.example .env
    warn ".env created from .env.example — edit with your keys"
else
    ok ".env already exists"
fi

# 3. Create databases
info "Creating PostgreSQL databases..."
for db in codecircle fixai metrics_explorer logs_explorer code_parser; do
    if psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$db"; then
        ok "Database '$db' already exists"
    else
        createdb -U postgres "$db" 2>/dev/null && ok "Created database '$db'" || warn "Could not create '$db' — create it manually"
    fi
done

# 4. Python virtual environments
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

# 5. Dashboard dependencies
info "Installing dashboard dependencies..."
cd dashboard && npm install --silent && cd ..
ok "Dashboard dependencies installed"

# 6. Run migrations
info "Running database migrations..."
(cd services/code-parser && source venv/bin/activate && alembic upgrade head 2>/dev/null) && ok "Code parser migrated" || warn "Code parser migration failed"
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
echo "  3. Open: http://localhost:5173"
echo ""
