"""Health check aggregator for all downstream services."""

from __future__ import annotations

import time

import httpx

from app.config import settings
from app.schemas.workspace import HealthStatus, PlatformHealth

_SERVICES = [
    ("FixAI", lambda: f"{settings.fixai_url}/health"),
    ("Metrics Explorer", lambda: f"{settings.metrics_explorer_url}/health"),
    ("Logs Explorer", lambda: f"{settings.logs_explorer_url}/health"),
    ("Code Parser", lambda: f"{settings.code_parser_url}/health"),
]


async def check_all() -> PlatformHealth:
    """Ping every downstream service and return aggregated health."""
    results: list[HealthStatus] = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
        for name, url_fn in _SERVICES:
            url = url_fn()
            t0 = time.monotonic()
            try:
                resp = await client.get(url)
                latency = round((time.monotonic() - t0) * 1000, 1)
                results.append(HealthStatus(
                    service=name,
                    url=url,
                    healthy=resp.status_code < 400,
                    latency_ms=latency,
                ))
            except Exception as exc:
                latency = round((time.monotonic() - t0) * 1000, 1)
                results.append(HealthStatus(
                    service=name,
                    url=url,
                    healthy=False,
                    latency_ms=latency,
                    error=str(exc),
                ))

    all_ok = all(s.healthy for s in results)
    return PlatformHealth(platform="ok" if all_ok else "degraded", services=results)
