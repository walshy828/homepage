"""
Homepage Dashboard - Main FastAPI Application
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:     %(message)s",
)
logger = logging.getLogger(__name__)

from app.api.routers import (
    auth_router,
    dashboards_router,
    widgets_router,
    links_router,
    notes_router,
    integrations_router,
    search_router,
    archives_router,
    system_router,
)


async def run_scheduled_backups():
    """Run backups at configured intervals."""
    import asyncio
    from app.services.backup import BackupService
    
    if not settings.backup_enabled:
        return
        
    backup_service = BackupService()
    logger.info(f"Scheduled backups enabled every {settings.backup_interval_hours} hours.")
    
    while True:
        try:
            # We don't want to backup immediately on startup in case it just crashed
            # But maybe we do? Let's wait a bit first.
            await asyncio.sleep(60 * 5) # Wait 5 minutes after startup
            
            logger.info("Running scheduled database backup...")
            filename = await backup_service.create_backup()
            logger.info(f"Scheduled backup completed: {filename}")
            
            # Now wait for the next interval
            await asyncio.sleep(settings.backup_interval_hours * 3600)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Scheduled backup failed: {e}")
            await asyncio.sleep(3600) # Wait an hour before retrying on error

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("----------------------------------------------------------------")
    print(f"Starting {settings.app_name}...")
    print("----------------------------------------------------------------")
    await init_db()
    
    # Start background backup task
    if settings.backup_enabled:
        import asyncio
        asyncio.create_task(run_scheduled_backups())
        
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
app.mount("/data", StaticFiles(directory="data"), name="data")

# API routers
app.include_router(auth_router, prefix="/api")
app.include_router(dashboards_router, prefix="/api")
app.include_router(widgets_router, prefix="/api")
app.include_router(links_router, prefix="/api")
app.include_router(notes_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")
app.include_router(archives_router, prefix="/api")
app.include_router(system_router, prefix="/api")


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
    # Return 404 for API paths to prevent 405 Method Not Allowed masking
    if path.startswith("api/"):
        return FileResponse("static/index.html", status_code=404)

    # Check if file exists in static directory
    static_path = f"static/{path}"
    if os.path.isfile(static_path):
        return FileResponse(static_path)
    return FileResponse("static/index.html")

