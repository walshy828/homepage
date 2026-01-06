from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, async_session_maker
from app.models.models import User, ArchivedPage
from app.schemas.schemas import ArchivedPageCreate, ArchivedPageResponse
from app.api.deps import get_current_user
from app.services.archiver import ContentArchiver

router = APIRouter()

@router.get("/", response_model=List[ArchivedPageResponse])
async def get_archives(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ArchivedPage)
        .where(ArchivedPage.owner_id == current_user.id)
        .order_by(ArchivedPage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def process_archive_task(archive_id: int, url: str):
    archiver = ContentArchiver()
    screenshot, content, title, error = await archiver.archive_url(url)
    
    async with async_session_maker() as session:
        # Use explicit transaction or just commit at end
        try:
            archive = await session.get(ArchivedPage, archive_id)
            if archive:
                if error:
                    archive.status = "failed"
                    archive.summary = f"Error: {error}"
                else:
                    archive.status = "completed"
                    archive.title = title or archive.title
                    archive.screenshot_path = screenshot
                    archive.content_file_path = content
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Error updating archive status: {e}")

@router.post("/", response_model=ArchivedPageResponse)
async def create_archive(
    item: ArchivedPageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    db_item = ArchivedPage(
        owner_id=current_user.id,
        url=item.url,
        title=item.title or item.url,
        status="pending"
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    background_tasks.add_task(process_archive_task, db_item.id, item.url)
    
    return db_item

@router.delete("/{archive_id}")
async def delete_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ArchivedPage).where(ArchivedPage.id == archive_id, ArchivedPage.owner_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Archive not found")
        
    await db.delete(item)
    await db.commit()
    return {"ok": True}
