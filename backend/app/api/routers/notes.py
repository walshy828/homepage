"""
Homepage Dashboard - Notes Router
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User, Note
from app.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.api.dependencies import get_current_user


router = APIRouter(prefix="/notes", tags=["Notes"])


@router.get("", response_model=List[NoteResponse])
async def list_notes(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_code: Optional[bool] = Query(None),
    pinned_only: bool = Query(False),
    show_as_widget: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all notes for current user."""
    query = select(Note).where(Note.owner_id == current_user.id)
    
    if category:
        query = query.where(Note.category == category)
    
    if is_code is not None:
        query = query.where(Note.is_code == is_code)
    
    if pinned_only:
        query = query.where(Note.is_pinned == True)
    
    if show_as_widget is not None:
        query = query.where(Note.show_as_widget == show_as_widget)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Note.title.ilike(search_term),
                Note.content.ilike(search_term)
            )
        )
    
    if sort_by == "recent":
        query = query.order_by(Note.last_viewed.desc().nulls_last(), Note.updated_at.desc())
    else:
        query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new note."""
    note = Note(
        owner_id=current_user.id,
        title=note_data.title,
        content=note_data.content,
        is_code=note_data.is_code,
        code_language=note_data.code_language,
        category=note_data.category,
        color=note_data.color,
        is_pinned=note_data.is_pinned,
        tags=note_data.tags,
        show_as_widget=note_data.show_as_widget,
        widget_grid_x=note_data.widget_grid_x or 0,
        widget_grid_y=note_data.widget_grid_y or 0,
        widget_grid_w=note_data.widget_grid_w or 3,
        widget_grid_h=note_data.widget_grid_h or 2
    )
    db.add(note)
    await db.flush()
    
    return note


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    if note_data.title is not None:
        note.title = note_data.title
    if note_data.content is not None:
        note.content = note_data.content
    if note_data.is_code is not None:
        note.is_code = note_data.is_code
    if note_data.code_language is not None:
        note.code_language = note_data.code_language
    if note_data.category is not None:
        note.category = note_data.category
    if note_data.color is not None:
        note.color = note_data.color
    if note_data.is_pinned is not None:
        note.is_pinned = note_data.is_pinned
    if note_data.tags is not None:
        note.tags = note_data.tags
    if note_data.show_as_widget is not None:
        note.show_as_widget = note_data.show_as_widget
    if note_data.widget_grid_x is not None:
        note.widget_grid_x = note_data.widget_grid_x
    if note_data.widget_grid_y is not None:
        note.widget_grid_y = note_data.widget_grid_y
    if note_data.widget_grid_w is not None:
        note.widget_grid_w = note_data.widget_grid_w
    if note_data.widget_grid_h is not None:
        note.widget_grid_h = note_data.widget_grid_h
    
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    await db.delete(note)


@router.post("/{note_id}/view", response_model=NoteResponse)
async def view_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a view on a note."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    note.last_viewed = datetime.utcnow()
    
    await db.flush()
    return note
