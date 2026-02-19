# CodeCircle

**AI-powered production debugging platform.** Connect your metrics, logs, and code — then let an AI agent investigate issues for you.

CodeCircle unifies four microservices into a single, enterprise-grade experience:

| Service | Purpose |
|---------|---------|
| **FixAI** | AI debugging agent (Claude) that orchestrates investigations |
| **Metrics Explorer** | Query dashboards & metrics from Datadog, Prometheus, Grafana |
| **Logs Explorer** | Search production logs from Splunk Cloud |
| **Code Parser** | Analyze code structure, call graphs, and entry points |

## Quick Start (Docker)

```bash
git clone --recurse-submodules https://github.com/pratikmishra356/codeCircle.git
cd codeCircle
cp .env.example .env
make up
```

Open **http://localhost:5173** and create your first workspace.

## Quick Start (Local Development)

```bash
git clone --recurse-submodules https://github.com/pratikmishra356/codeCircle.git
cd codeCircle
make setup
make dev
```

Open **http://localhost:5173**.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   CodeCircle Dashboard                   │
│                     (React, :5173)                       │
└─────────┬──────────────────────────┬─────────────────────┘
          │ /api/platform/*          │ /api/v1/*
          ▼                          ▼
┌──────────────────┐     ┌──────────────────────┐
│  Platform API    │     │      FixAI Agent      │
│   (:8200)        │     │       (:8100)         │
│  - Workspaces    │     │  - Chat (SSE)         │
│  - Setup Wizard  │     │  - 14 Tools           │
│  - Provisioning  │     │  - Claude LLM         │
│  - Health Checks │     └────┬────┬────┬────────┘
└──────────────────┘          │    │    │
                              ▼    ▼    ▼
              ┌───────────┐ ┌────┐ ┌──────────┐
              │ Metrics   │ │Logs│ │  Code    │
              │ Explorer  │ │Expl│ │  Parser  │
              │  (:8001)  │ │(:80│ │ (:8000)  │
              └───────────┘ │03) │ └──────────┘
                            └────┘
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │    (:5432)      │
                    └─────────────────┘
```

## Configuration

### Environment Variables (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `ENCRYPTION_KEY` | Fernet key for encrypting credentials | — |
| `CLAUDE_API_KEY` | Anthropic API key | — |
| `CLAUDE_BEDROCK_URL` | AWS Bedrock proxy URL | — |
| `CLAUDE_MODEL_ID` | Claude model identifier | `anthropic.claude-sonnet-4-20250514-v1:0` |

### Port Allocation

| Service | Backend | Frontend |
|---------|---------|----------|
| Code Parser | 8000 | 3000 |
| Metrics Explorer | 8001 | 3002 |
| Logs Explorer | 8003 | 3003 |
| FixAI | 8100 | 3006 |
| Platform API | 8200 | — |
| Dashboard | — | 5173 |

## Make Commands

```bash
make setup      # Install deps, create DBs, run migrations
make dev        # Start all services locally
make dev-backends  # Start backends + dashboard only
make migrate    # Run database migrations
make up         # Start with Docker Compose
make down       # Stop all services
make clean      # Stop and remove all data
make help       # Show all commands
```

## Project Structure

```
codeCircle/
├── services/                 # Git submodules
│   ├── fixai/                # AI debugging agent
│   ├── metrics-explorer/     # Metrics provider adapter
│   ├── logs-explorer/        # Logs provider adapter
│   └── code-parser/          # AST analysis + call graphs
├── platform/                 # Orchestrator API (FastAPI)
├── dashboard/                # Unified UI (React + TypeScript)
├── Makefile                  # Developer commands
└── setup.sh                  # Local development setup
```

## Troubleshooting

### FixAI: `relation "conversations" does not exist`

```bash
git pull && git submodule update --init --recursive
make migrate
```

If still failing, reset migration history and retry:

```bash
psql -U postgres -d fixai -c "DROP TABLE IF EXISTS alembic_version;"
make migrate
```

### `Cannot find module '.../node_modules/vite/dist/node/cli.js'`

```bash
cd services/code-parser/frontend   # or whichever service
rm -rf node_modules && npm install
```

## License

MIT
