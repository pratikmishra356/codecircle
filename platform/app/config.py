"""Platform configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/codecircle"

    # Service URLs (internal Docker network or local)
    fixai_url: str = "http://localhost:8100"
    metrics_explorer_url: str = "http://localhost:8001"
    logs_explorer_url: str = "http://localhost:8003"
    code_parser_url: str = "http://localhost:8000"

    # Encryption
    encryption_key: str = ""

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    port: int = 8200

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
