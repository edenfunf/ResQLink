from __future__ import annotations

import logging

import hmac

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.routers import (
    agent,
    alerts,
    artifacts,
    assignments,
    assistant,
    bootstrap,
    connectors,
    deliverables,
    demo,
    form_submissions,
    health,
    incidents,
    modules,
    overview,
    preview,
    publications,
    reports,
    resources,
    reviews,
    summary,
    timeline,
)

logger = logging.getLogger("resqlink")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="堰塞湖災害通報與救災入口生成元件。",
)

# Origins come from CORS_ORIGINS ("*" allows any origin; the CORS spec then
# forbids credentials, which this API does not use anyway).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.cors_allow_all else settings.cors_origins_list,
    allow_credentials=not settings.cors_allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,  # cache preflights; cross-origin POSTs then pay it once
)

# Paths that stay open even when the API-key gate is on: liveness, docs and
# the citizen-facing public surface (preview, report/resource submission).
_PUBLIC_PREFIXES = (
    "/v1/health",
    "/v1/public/",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _is_public(path: str, method: str) -> bool:
    if path == "/" or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return True
    # citizen submissions from the generated rescue portal
    if method == "POST" and (
        path.endswith("/reports") or path.endswith("/resources")
    ):
        return True
    if method == "GET" and path.endswith("/reports.geojson"):
        return True
    return False


@app.middleware("http")
async def api_key_gate(request: Request, call_next):
    """Optional access control: with ADMIN_API_KEY set, every non-public
    endpoint requires a matching X-API-Key header. Unset (demo) => open."""
    if settings.ADMIN_API_KEY and request.method != "OPTIONS":
        if not _is_public(request.url.path, request.method):
            provided = request.headers.get("X-API-Key", "")
            if not hmac.compare_digest(provided, settings.ADMIN_API_KEY):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid X-API-Key."},
                )
    return await call_next(request)


app.include_router(health.router)
app.include_router(alerts.router)
app.include_router(incidents.router)
app.include_router(bootstrap.router)
app.include_router(modules.router)
app.include_router(agent.router)
app.include_router(form_submissions.router)
app.include_router(connectors.router)
app.include_router(artifacts.router)
app.include_router(reviews.router)
app.include_router(reports.router)
app.include_router(resources.router)
app.include_router(assignments.router)
app.include_router(publications.router)
app.include_router(preview.router)
app.include_router(summary.router)
app.include_router(deliverables.router)
app.include_router(demo.router)
app.include_router(assistant.router)
app.include_router(timeline.router)
app.include_router(overview.router)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(
    request: Request, exc: SQLAlchemyError
) -> JSONResponse:
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal database error."},
    )


def _custom_openapi() -> dict:
    """Declare the API-key scheme globally so the spec documents how access is
    controlled (enforced by api_key_gate when ADMIN_API_KEY is configured)."""
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {})["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": (
                "設定 ADMIN_API_KEY 後，非公開端點需帶此標頭；"
                "公開災民端點（health / public preview / 通報與資源登錄）不需要。"
            ),
        }
    }
    schema["security"] = [{"ApiKeyAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = _custom_openapi  # type: ignore[method-assign]


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "service": "resqlink-api",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/v1/health",
    }
