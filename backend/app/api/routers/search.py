"""
Homepage Dashboard - Search Router
"""
from typing import List, Union
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.models import User, Link, Note
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])


class SearchResult(BaseModel):
    id: int
    type: str  # "link" or "note"
    title: str
    subtitle: str  # URL for links, snippet for notes
    url: str  # Actual URL or internal link
    icon: str  # Emoji or favicon URL


@router.get("", response_model=List[SearchResult])
async def search_global(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search links and notes globally.
    """
    search_term = f"%{q}%"
    results = []
    
    # 1. Search Links
    relevancy_score = case(
        (Link.url.ilike(search_term), 10),
        (Link.title.ilike(search_term), 5),
        (Link.description.ilike(search_term), 1),
        else_=0
    )
    
    link_query = select(Link).where(
        Link.owner_id == current_user.id,
        or_(
            Link.title.ilike(search_term),
            Link.url.ilike(search_term),
            Link.description.ilike(search_term)
        )
    ).order_by(desc(relevancy_score)).limit(10)
    
    link_results = await db.execute(link_query)
    for link in link_results.scalars():
        results.append(SearchResult(
            id=link.id,
            type="link",
            title=link.title,
            subtitle=link.url,
            url=link.url,
            icon=link.custom_icon or link.favicon_url or "🔗"
        ))
        
    # 2. Search Notes
    note_query = select(Note).where(
        Note.owner_id == current_user.id,
        or_(
            Note.title.ilike(search_term),
            Note.content.ilike(search_term)
        )
    ).limit(10)
    
    note_results = await db.execute(note_query)
    for note in note_results.scalars():
        # Create a text snippet from content (stripping HTML if possible, or just raw)
        snippet = note.content[:50] + "..." if len(note.content) > 50 else note.content
        results.append(SearchResult(
            id=note.id,
            type="note",
            title=note.title,
            subtitle=snippet,
            url=f"#note-{note.id}", # Frontend handles this
            icon="📝"
        ))
    
    return results
