"""
Homepage Dashboard - Dashboards Router
"""
import secrets
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import User, Dashboard, Widget
from app.schemas import (
    DashboardCreate, DashboardUpdate, DashboardResponse,
    WidgetResponse, WidgetPositionUpdate
)
from app.api.dependencies import get_current_user, get_current_user_optional


router = APIRouter(prefix="/dashboards", tags=["Dashboards"])


@router.get("", response_model=List[DashboardResponse])
async def list_dashboards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all dashboards for current user."""
    result = await db.execute(
        select(Dashboard).where(Dashboard.owner_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard_data: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new dashboard."""
    # If setting as default, unset other defaults
    if dashboard_data.is_default:
        result = await db.execute(
            select(Dashboard).where(
                Dashboard.owner_id == current_user.id,
                Dashboard.is_default == True
            )
        )
        for dash in result.scalars().all():
            dash.is_default = False
    
    dashboard = Dashboard(
        owner_id=current_user.id,
        name=dashboard_data.name,
        is_default=dashboard_data.is_default
    )
    db.add(dashboard)
    await db.flush()
    
    return dashboard


@router.get("/default", response_model=DashboardResponse)
async def get_default_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the user's default dashboard."""
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.owner_id == current_user.id,
            Dashboard.is_default == True
        )
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        # Get first dashboard if no default set
        result = await db.execute(
            select(Dashboard).where(Dashboard.owner_id == current_user.id).limit(1)
        )
        dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No dashboard found"
        )
    
    return dashboard


@router.get("/shared/{share_token}")
async def get_shared_dashboard(
    share_token: str,
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get a shared dashboard by its share token."""
    result = await db.execute(
        select(Dashboard)
        .options(selectinload(Dashboard.widgets))
        .where(Dashboard.share_token == share_token, Dashboard.is_shared == True)
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared dashboard not found"
        )
    
    return {
        "dashboard": DashboardResponse.model_validate(dashboard),
        "widgets": [WidgetResponse.model_validate(w) for w in dashboard.widgets]
    }


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific dashboard."""
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return dashboard


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: int,
    dashboard_data: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a dashboard."""
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    if dashboard_data.name is not None:
        dashboard.name = dashboard_data.name
    
    if dashboard_data.icon is not None:
        dashboard.icon = dashboard_data.icon if dashboard_data.icon else None
    
    if dashboard_data.is_default is not None:
        if dashboard_data.is_default:
            # Unset other defaults
            result = await db.execute(
                select(Dashboard).where(
                    Dashboard.owner_id == current_user.id,
                    Dashboard.is_default == True,
                    Dashboard.id != dashboard_id
                )
            )
            for dash in result.scalars().all():
                dash.is_default = False
        dashboard.is_default = dashboard_data.is_default
    
    if dashboard_data.is_shared is not None:
        dashboard.is_shared = dashboard_data.is_shared
        if dashboard_data.is_shared and not dashboard.share_token:
            dashboard.share_token = secrets.token_urlsafe(32)
        elif not dashboard_data.is_shared:
            dashboard.share_token = None
    
    return dashboard


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a dashboard."""
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    await db.delete(dashboard)


@router.get("/{dashboard_id}/widgets", response_model=List[WidgetResponse])
async def get_dashboard_widgets(
    dashboard_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all widgets for a dashboard."""
    # Verify dashboard ownership
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    result = await db.execute(
        select(Widget).where(Widget.dashboard_id == dashboard_id)
    )
    return result.scalars().all()


@router.put("/{dashboard_id}/widgets/positions")
async def update_widget_positions(
    dashboard_id: int,
    positions: List[WidgetPositionUpdate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Batch update widget positions after drag/drop."""
    # Verify dashboard ownership
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Update each widget position
    for pos in positions:
        result = await db.execute(
            select(Widget).where(
                Widget.id == pos.id,
                Widget.dashboard_id == dashboard_id
            )
        )
        widget = result.scalar_one_or_none()
        if widget:
            widget.grid_x = pos.grid_x
            widget.grid_y = pos.grid_y
            widget.grid_w = pos.grid_w
            widget.grid_h = pos.grid_h
    
    return {"updated": len(positions)}
