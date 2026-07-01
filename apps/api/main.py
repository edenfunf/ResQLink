from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.routers import (
    agent,
    alerts,
    artifacts,
    assignments,
    bootstrap,
    connectors,
    deliverables,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "service": "resqlink-api",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/v1/health",
    }
