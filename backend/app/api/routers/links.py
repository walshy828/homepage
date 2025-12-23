"""
Homepage Dashboard - Links Router
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User, Link
from app.services import gemini_service, LINK_CATEGORIES
import httpx
from bs4 import BeautifulSoup
from app.api.dependencies import get_current_user
from app.schemas import LinkCreate, LinkUpdate, LinkResponse, CategorizeLinkRequest, CategorizeLinkResponse, LinkPreviewResponse, SuggestTagsResponse


router = APIRouter(prefix="/links", tags=["Links"])


@router.get("/tags/suggest", response_model=SuggestTagsResponse)
async def suggest_tags(
    url: str = Query(..., description="URL to analyze"),
    title: Optional[str] = Query(None, description="Page title")
):
    """Suggest tags for a link using AI."""
    if not gemini_service.is_available:
        return SuggestTagsResponse(tags=[])
    
    tags = await gemini_service.suggest_tags(url=url, title=title)
    return SuggestTagsResponse(tags=tags)


@router.get("", response_model=List[LinkResponse])
async def list_links(
    category: Optional[str] = Query(None),
    widget_id: Optional[int] = Query(None),
    unassigned: bool = Query(False),
    search: Optional[str] = Query(None),
    pinned_only: bool = Query(False),
    sort_by: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all links for current user."""
    query = select(Link).where(Link.owner_id == current_user.id)
    
    if widget_id is not None:
        query = query.where(Link.widget_id == widget_id)
    elif unassigned:
        query = query.where(Link.widget_id.is_(None))
    
    if category:
        query = query.where(Link.category == category)
    
    if pinned_only:
        query = query.where(Link.is_pinned == True)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Link.title.ilike(search_term),
                Link.url.ilike(search_term),
                Link.description.ilike(search_term)
            )
        )
    
    
    if sort_by == "recent":
        # Sort by last_clicked desc, then created_at
        query = query.order_by(Link.last_clicked.desc().nulls_last(), Link.created_at.desc())
    elif sort_by == "popular":
        # Sort by click_count desc
        query = query.order_by(Link.click_count.desc(), Link.created_at.desc())
    else:
        query = query.order_by(Link.is_pinned.desc(), Link.display_order, Link.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/categories")
async def list_categories():
    """Get available link categories."""
    return {"categories": LINK_CATEGORIES}


@router.post("", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
async def create_link(
    link_data: LinkCreate,
    auto_categorize: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new link."""
    # Auto-extract title if not provided
    title = link_data.title or link_data.url
    
    link = Link(
        owner_id=current_user.id,
        url=link_data.url,
        title=title,
        description=link_data.description,
        image_url=link_data.image_url,
        category=link_data.category,
        custom_tags=link_data.custom_tags,
        is_pinned=link_data.is_pinned,
        widget_id=link_data.widget_id,
        custom_icon=link_data.custom_icon
    )
    
    # Auto-fetch metadata if title or description or image is missing
    if not link_data.title or not link_data.description or not link_data.image_url:
        try:
            preview = await preview_link(link_data.url)
            if not link_data.title and preview.title:
                link.title = preview.title
            if not link_data.description and preview.description:
                link.description = preview.description
            if not link_data.image_url and preview.image:
                link.image_url = preview.image
        except Exception:
            pass
    
    # Auto-categorize with AI if requested
    if auto_categorize and link_data.category == "uncategorized":
        category = await gemini_service.categorize_link(
            url=link_data.url,
            title=title,
            description=link_data.description
        )
        link.category = category
        link.is_ai_categorized = True
    
    db.add(link)
    await db.flush()
    
    return link


@router.post("/categorize", response_model=CategorizeLinkResponse)
async def categorize_links(
    request: CategorizeLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Categorize links using AI."""
    if not gemini_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI categorization is not configured"
        )
    
    # Get links to categorize
    if request.categorize_all:
        result = await db.execute(
            select(Link).where(
                Link.owner_id == current_user.id,
                Link.category == "uncategorized"
            )
        )
    else:
        result = await db.execute(
            select(Link).where(
                Link.owner_id == current_user.id,
                Link.id.in_(request.link_ids)
            )
        )
    
    links = result.scalars().all()
    
    # Prepare links for batch categorization
    links_data = [
        {"id": link.id, "url": link.url, "title": link.title, "description": link.description}
        for link in links
    ]
    
    # Categorize
    results = await gemini_service.categorize_links_batch(links_data)
    
    # Update links
    result_map = {r["id"]: r["category"] for r in results}
    for link in links:
        if link.id in result_map:
            link.category = result_map[link.id]
            link.is_ai_categorized = True
    
    return CategorizeLinkResponse(
        categorized_count=len(results),
        results=results
    )


@router.get("/preview", response_model=LinkPreviewResponse)
async def preview_link(url: str = Query(..., description="URL to preview")):
    """Fetch Open Graph metadata for a URL."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            title = None
            description = None
            image = None
            
            # Try Open Graph tags first
            og_title = soup.find("meta", property="og:title")
            og_desc = soup.find("meta", property="og:description")
            og_image = soup.find("meta", property="og:image")
            
            if og_title:
                title = og_title.get("content")
            if og_desc:
                description = og_desc.get("content")
            if og_image:
                image = og_image.get("content")
                
            # Fallback to standard tags
            if not title:
                title_tag = soup.find("title")
                if title_tag:
                    title = title_tag.string
            
            if not description:
                desc_tag = soup.find("meta", attrs={"name": "description"})
                if desc_tag:
                    description = desc_tag.get("content")
            
            # Resolve relative image URLs
            if image and not image.startswith(("http://", "https://")):
                from urllib.parse import urljoin
                image = urljoin(url, image)

            return LinkPreviewResponse(
                url=url,
                title=title,
                description=description,
                image=image
            )
            
    except Exception as e:
        # Don't fail hard, just return what we have (or empty)
        print(f"Error fetching preview for {url}: {e}")
        return LinkPreviewResponse(url=url, title="Preview unavailable")


@router.get("/{link_id}", response_model=LinkResponse)
async def get_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific link."""
    result = await db.execute(
        select(Link).where(Link.id == link_id, Link.owner_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found"
        )
    
    return link


@router.patch("/{link_id}", response_model=LinkResponse)
async def update_link(
    link_id: int,
    link_data: LinkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a link."""
    result = await db.execute(
        select(Link).where(Link.id == link_id, Link.owner_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found"
        )
    
    if link_data.url is not None:
        link.url = link_data.url
    if link_data.title is not None:
        link.title = link_data.title
    if link_data.description is not None:
        link.description = link_data.description
    if link_data.image_url is not None:
        link.image_url = link_data.image_url
    if link_data.category is not None:
        link.category = link_data.category
        link.is_ai_categorized = False
    if link_data.custom_tags is not None:
        link.custom_tags = link_data.custom_tags
    if link_data.is_pinned is not None:
        link.is_pinned = link_data.is_pinned
    if link_data.display_order is not None:
        link.display_order = link_data.display_order
    if link_data.widget_id is not None:
        link.widget_id = link_data.widget_id
    if link_data.custom_icon is not None:
        link.custom_icon = link_data.custom_icon if link_data.custom_icon else None
    
    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a link."""
    result = await db.execute(
        select(Link).where(Link.id == link_id, Link.owner_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found"
        )
    
    
    await db.delete(link)


@router.post("/{link_id}/click", response_model=LinkResponse)
async def click_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Record a click on a link."""
    result = await db.execute(
        select(Link).where(Link.id == link_id, Link.owner_id == current_user.id)
    )
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found"
        )
    
    link.last_clicked = datetime.utcnow()
    link.click_count += 1
    
    await db.flush()
    return link
