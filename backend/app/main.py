"""
Homepage Dashboard - Main FastAPI Application
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import init_db
from app.api.routers import (
    auth_router,
    dashboards_router,
    widgets_router,
    links_router,
    notes_router,
    notes_router,
    integrations_router,
    search_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("----------------------------------------------------------------")
    print(f"Starting {settings.app_name}...")
    print("----------------------------------------------------------------")
    await init_db()
    print("----------------------------------------------------------------")
    print(f"Server is running!")
    print(f"Access the dashboard at: http://0.0.0.0:8000")
    print("----------------------------------------------------------------")
    yield
    # Shutdown
    pass


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="A modern, customizable homepage dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directories
app.mount("/css", StaticFiles(directory="static/css"), name="css")
app.mount("/js", StaticFiles(directory="static/js"), name="js")

# API routers
app.include_router(auth_router, prefix="/api")
app.include_router(dashboards_router, prefix="/api")
app.include_router(widgets_router, prefix="/api")
app.include_router(links_router, prefix="/api")
app.include_router(notes_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    return {"status": "healthy", "app": settings.app_name}


@app.get("/")
async def root():
    """Serve the main dashboard page."""
    return FileResponse("static/index.html")


@app.get("/{path:path}")
async def catch_all(path: str):
    """Catch-all for SPA routing - serve index.html for non-file paths."""
    # Check if file exists in static directory
    static_path = f"static/{path}"
    if os.path.isfile(static_path):
        return FileResponse(static_path)
    return FileResponse("static/index.html")

