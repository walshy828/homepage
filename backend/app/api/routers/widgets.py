"""
Homepage Dashboard - Widgets Router
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User, Dashboard, Widget
from app.schemas import WidgetCreate, WidgetUpdate, WidgetResponse
from app.api.dependencies import get_current_user


router = APIRouter(prefix="/widgets", tags=["Widgets"])


@router.post("", response_model=WidgetResponse, status_code=status.HTTP_201_CREATED)
async def create_widget(
    widget_data: WidgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new widget."""
    # Verify dashboard ownership
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.id == widget_data.dashboard_id,
            Dashboard.owner_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widget = Widget(
        dashboard_id=widget_data.dashboard_id,
        widget_type=widget_data.widget_type,
        title=widget_data.title,
        grid_x=widget_data.grid_x,
        grid_y=widget_data.grid_y,
        grid_w=widget_data.grid_w,
        grid_h=widget_data.grid_h,
        config=widget_data.config
    )
    db.add(widget)
    await db.flush()
    
    return widget


@router.get("/{widget_id}", response_model=WidgetResponse)
async def get_widget(
    widget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific widget."""
    result = await db.execute(
        select(Widget)
        .join(Dashboard)
        .where(Widget.id == widget_id, Dashboard.owner_id == current_user.id)
    )
    widget = result.scalar_one_or_none()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    return widget


@router.patch("/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    widget_id: int,
    widget_data: WidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a widget."""
    result = await db.execute(
        select(Widget)
        .join(Dashboard)
        .where(Widget.id == widget_id, Dashboard.owner_id == current_user.id)
    )
    widget = result.scalar_one_or_none()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    if widget_data.title is not None:
        widget.title = widget_data.title
    if widget_data.grid_x is not None:
        widget.grid_x = widget_data.grid_x
    if widget_data.grid_y is not None:
        widget.grid_y = widget_data.grid_y
    if widget_data.grid_w is not None:
        widget.grid_w = widget_data.grid_w
    if widget_data.grid_h is not None:
        widget.grid_h = widget_data.grid_h
    if widget_data.config is not None:
        widget.config = widget_data.config
    
    return widget


@router.delete("/{widget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_widget(
    widget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a widget."""
    result = await db.execute(
        select(Widget)
        .join(Dashboard)
        .where(Widget.id == widget_id, Dashboard.owner_id == current_user.id)
    )
    widget = result.scalar_one_or_none()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    await db.delete(widget)
