"""app/main.py

FastAPI application factory with structured JSON logging and global error handling.
"""
from __future__ import annotations

import json
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.models.errors import ErrorResponse


class JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON strings.

    Each record is serialised with at minimum:
        timestamp, level, message
    Any extra fields stored under ``record.extra`` are merged into the
    top-level JSON object so they appear as first-class keys.
    """

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        log_obj: dict = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        # Merge any extra fields provided via extra={"extra": {...}}
        extra = getattr(record, "extra", None)
        if isinstance(extra, dict):
            log_obj.update(extra)
        return json.dumps(log_obj)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    # ------------------------------------------------------------------ #
    # Logging                                                              #
    # ------------------------------------------------------------------ #
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # ------------------------------------------------------------------ #
    # FastAPI instance                                                     #
    # ------------------------------------------------------------------ #
    application = FastAPI(title="Resume Parser Pipeline")

    # ------------------------------------------------------------------ #
    # CORS Configuration                                                   #
    # ------------------------------------------------------------------ #
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------ #
    # Global exception handler                                            #
    # ------------------------------------------------------------------ #
    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        body = ErrorResponse(
            error_code="INTERNAL_ERROR",
            message="An unexpected error occurred",
            stage="unknown",
            details={},
        )
        return JSONResponse(status_code=500, content=body.model_dump())

    # ------------------------------------------------------------------ #
    # Routers                                                              #
    # ------------------------------------------------------------------ #
    from app.api.routes import router  # local import to avoid circular deps
    application.include_router(router, prefix="")

    return application


app = create_app()
