"""CodeCircle Platform API — lightweight orchestrator for all services."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.setup import router as setup_router
from app.api.workspaces import router as workspaces_router
from app.config import settings
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="CodeCircle Platform",
    description="Unified orchestrator for FixAI, Metrics Explorer, Logs Explorer, and Code Parser",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow dashboard origin in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health_router)
app.include_router(workspaces_router)
app.include_router(setup_router)
