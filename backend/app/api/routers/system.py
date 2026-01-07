import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict
import os
import shutil

from app.core.database import get_db
from app.models.models import User
from app.api.dependencies import get_current_user
from app.services.backup import BackupService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["System"])
backup_service = BackupService()

@router.post("/system/backup", response_model=Dict)
async def create_backup(current_user: User = Depends(get_current_user)):
    """Trigger a manual database backup."""
    logger.info(f"User {current_user.username} triggered manual backup")
    try:
        filename = await backup_service.create_backup()
        logger.info(f"Manual backup created: {filename}")
        return {"ok": True, "filename": filename}
    except Exception as e:
        logger.error(f"Manual backup failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/backups", response_model=List[Dict])
async def list_backups(current_user: User = Depends(get_current_user)):
    """List all available backups."""
    return backup_service.list_backups()

@router.post("/system/backups/{filename}/restore")
async def restore_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Restore database from a specific backup file."""
    logger.info(f"User {current_user.username} triggered restore from {filename}")
    try:
        await backup_service.restore_backup(filename)
        logger.info(f"Database restored successfully from {filename}")
        return {"ok": True, "message": "Database restored successfully. Application might need a restart."}
    except Exception as e:
        logger.error(f"Restore failed from {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/system/backups/{filename}")
async def delete_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Delete a backup file."""
    logger.info(f"User {current_user.username} deleting backup {filename}")
    try:
        backup_service.delete_backup(filename)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to delete backup {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/backups/{filename}/download")
async def download_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Download a backup file."""
    logger.info(f"User {current_user.username} downloading backup {filename}")
    filepath = os.path.join(backup_service.backup_dir, filename)
    if not os.path.exists(filepath):
        logger.warning(f"Download failed: {filename} not found")
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(filepath, filename=filename)

@router.post("/system/import")
async def import_database(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload and import a database backup."""
    logger.info(f"[System] Starting database import request: {file.filename} ({file.content_type})")
    
    # Save the uploaded file temporarily using non-blocking chunks
    temp_path = os.path.join(backup_service.backup_dir, f"upload_{file.filename}")
    try:
        logger.info(f"[System] Saving upload to {temp_path}...")
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024) # 1MB chunks
                if not chunk:
                    break
                buffer.write(chunk)
        
        logger.info(f"[System] Upload saved. Size: {os.path.getsize(temp_path)} bytes. Starting restoration...")
        
        # Restore from this file (this is now async/non-blocking)
        await backup_service.restore_backup(os.path.basename(temp_path))
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        logger.info("[System] Database import and restoration completed successfully")
        return {"ok": True, "message": "Database imported successfully."}
    except Exception as e:
        logger.error(f"[System] Database import failed: {str(e)}", exc_info=True)
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))
