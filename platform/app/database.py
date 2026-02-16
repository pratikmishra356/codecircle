"""Async SQLAlchemy database setup."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_size=5, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables (dev convenience — use Alembic in production)."""
    # Import models so Base.metadata knows about them
    import app.models.ai_config  # noqa: F401
    import app.models.workspace  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add workspace_id to ai_config if missing (one-off migration)
        await conn.run_sync(_migrate_ai_config_workspace_id)


def _migrate_ai_config_workspace_id(conn):
    """Add workspace_id column to ai_config for workspace-level AI settings."""
    from sqlalchemy import text
    result = conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'ai_config' AND column_name = 'workspace_id'"
    ))
    if result.scalar() is None:
        conn.execute(text("ALTER TABLE ai_config ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE"))
        conn.execute(text("CREATE UNIQUE INDEX ai_config_workspace_id_key ON ai_config (workspace_id)"))
        # Allow only one global (null) row
        conn.execute(text(
            "CREATE UNIQUE INDEX ai_config_global_key ON ai_config ((1)) WHERE workspace_id IS NULL"
        ))


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
