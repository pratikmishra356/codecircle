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
# Clone with all services
git clone --recurse-submodules https://github.com/pratikmishra356/codeCircle.git
cd codeCircle

# Copy env and add your keys
cp .env.example .env

# Start everything
make up
```

Open **http://localhost:5173** and create your first workspace.

## Quick Start (Local Development)

```bash
git clone --recurse-submodules https://github.com/pratikmishra356/codeCircle.git
cd codeCircle

# Install dependencies, create databases, run migrations
make setup

# Start all services in parallel
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

## How It Works

1. **Create a Workspace** — name your debugging environment
2. **Configure Providers** — add API keys for your metrics (Datadog), logs (Splunk), and AI (Claude)
3. **Point to Code** — specify the local path to your codebase
4. **Launch** — CodeCircle provisions organizations across all services automatically
5. **Debug** — start a chat session and describe your production issue. The AI agent will search code, query metrics, and analyze logs.

## Setup Wizard

The setup wizard walks you through configuring each provider:

| Step | Provider | Credentials Needed |
|------|----------|--------------------|
| AI Provider | Anthropic API or AWS Bedrock | API key or Bedrock URL |
| Metrics | Datadog | API key + Application key |
| Metrics | Prometheus | Endpoint URL (+ optional auth) |
| Metrics | Grafana | Endpoint URL + API key |
| Logs | Splunk Cloud | Host URL + session cookie + CSRF token |
| Code | Local repository | Filesystem path |

Steps are optional — skip what you don't need and configure later.

## Configuration

### Environment Variables (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `ENCRYPTION_KEY` | Fernet key for encrypting credentials | For production |
| `CLAUDE_API_KEY` | Anthropic API key | One of these |
| `CLAUDE_BEDROCK_URL` | AWS Bedrock proxy URL | One of these |
| `CLAUDE_MODEL_ID` | Claude model identifier | No (has default) |

Generate an encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Port Allocation

| Service | Port |
|---------|------|
| Dashboard | 5173 |
| Platform API | 8200 |
| FixAI | 8100 |
| Metrics Explorer | 8001 |
| Logs Explorer | 8003 |
| Code Parser | 8000 |
| PostgreSQL | 5432 |

## Make Commands

```bash
make help       # Show all commands
make up         # Start with Docker Compose
make down       # Stop all services
make logs       # Tail all service logs
make logs-fixai # Tail specific service logs
make status     # Show service status
make setup      # Local dev setup (venvs, deps, DBs)
make dev        # Start local dev servers (pulls submodules first)
make submodule-pull   # Fetch latest from submodule remotes only
make clean      # Stop and remove all data
make migrate    # Run database migrations
```

### Getting new changes from remote (submodules)

We **prefer remote**: setup and `make dev` both try to use the latest from each submodule’s remote. If a submodule has **local or uncommitted changes**, that submodule is left unchanged (local fallback) so setup and dev don’t fail.

- **Normal case** — Run `make dev`. It runs `submodule-pull` first, so you get the latest from fixai, code-parser, etc. Restart `make dev` after pulling to run the new code.
- **Update submodules only** — Run `make submodule-pull`. Then start or restart `make dev`.
- **Submodule has local changes** — Git will skip updating that submodule. To take remote changes anyway either:
  - Stash or commit inside that submodule (`cd services/fixai && git stash` or `git add ... && git commit`), then from the repo root run `git submodule update --init --remote services/fixai`, or
  - Discard local changes in that submodule (e.g. `cd services/fixai && git checkout -- . && git clean -fd`) then run `make submodule-pull` or `make dev`.

## Project Structure

```
codeCircle/
├── services/                 # Git submodules
│   ├── fixai/                # AI debugging agent
│   ├── metrics-explorer/     # Metrics provider adapter
│   ├── logs-explorer/        # Logs provider adapter
│   └── code-parser/          # AST analysis + call graphs
├── platform/                 # Orchestrator API (FastAPI)
│   └── app/
│       ├── api/              # REST endpoints
│       ├── models/           # Workspace model
│       ├── schemas/          # Request/response schemas
│       └── services/         # Provisioner + health checks
├── dashboard/                # Unified UI (React + TypeScript)
│   └── src/
│       ├── pages/            # Landing, SetupWizard, Dashboard, Chat
│       ├── components/       # Layout, shared components
│       └── api/              # API client + types
├── docker/                   # Docker utilities
├── docker-compose.yml        # Full stack orchestration
├── Makefile                  # Developer commands
└── setup.sh                  # Local development setup
```

## API Documentation

When running, Swagger docs are available at:

- Platform: http://localhost:8200/docs
- FixAI: http://localhost:8100/docs
- Metrics Explorer: http://localhost:8001/docs
- Logs Explorer: http://localhost:8003/docs
- Code Parser: http://localhost:8000/docs

## Development

Each service is an independent git submodule that can be developed separately. The platform layer and dashboard are part of this repository.

### Adding a New Provider

- **Metrics**: Add adapter in `services/metrics-explorer/app/adapters/`
- **Logs**: Add provider in `services/logs-explorer/backend/app/providers/`

### Running Tests

```bash
cd services/code-parser && pytest
cd services/metrics-explorer && pytest
```

## License

MIT
