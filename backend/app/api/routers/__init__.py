"""API routers package."""
from app.api.routers.auth import router as auth_router
from app.api.routers.dashboards import router as dashboards_router
from app.api.routers.widgets import router as widgets_router
from app.api.routers.links import router as links_router
from app.api.routers.notes import router as notes_router
from app.api.routers.integrations import router as integrations_router
from app.api.routers.search import router as search_router

__all__ = [
    "auth_router",
    "dashboards_router",
    "widgets_router",
    "links_router",
    "notes_router",
    "integrations_router",
    "search_router",
]
