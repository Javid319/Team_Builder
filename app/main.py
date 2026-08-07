from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.core.config import settings
import app.db.base  # noqa: F401 — registers all models with SQLAlchemy mapper
from app.api.routes import auth, profile, assessment, collaboration

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1")
app.include_router(profile.router,       prefix="/api/v1")
app.include_router(assessment.router,    prefix="/api/v1")
app.include_router(collaboration.router, prefix="/api/v1")

# ── Serve static assets ────────────────────────────────────────
frontend_path = Path("frontend")
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# ── Serve frontend UI ─────────────────────────────────────────
@app.get("/", include_in_schema=False)
def frontend_root():
    return FileResponse("frontend/pages/index.html")

@app.get("/app", include_in_schema=False)
def frontend_app():
    return FileResponse("frontend/pages/app.html")

# ── Health check ──────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": settings.app_version}
