"""Netlify serverless entrypoint for FastAPI."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mangum import Mangum  # noqa: E402

from api.main import app  # noqa: E402

_asgi = Mangum(app, lifespan="off")


def _normalize_path(event: dict) -> dict:
    """Привести путь к виду /api/... для маршрутов FastAPI."""
    path = event.get("path") or event.get("rawPath") or ""
    if path.startswith("/.netlify/functions/api"):
        path = "/api" + path[len("/.netlify/functions/api") :]
    elif path and not path.startswith("/api"):
        path = "/api" + path
    event = dict(event)
    event["path"] = path
    if "rawPath" in event:
        event["rawPath"] = path
    return event


def handler(event, context):
    return _asgi(_normalize_path(event), context)
