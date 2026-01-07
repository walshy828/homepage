from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict
import os
import shutil

from app.core.database import get_db
from app.models.models import User
from app.api.dependencies import get_current_user
from app.services.backup import BackupService

router = APIRouter(tags=["System"])
backup_service = BackupService()

@router.post("/system/backup", response_model=Dict)
async def create_backup(current_user: User = Depends(get_current_user)):
    """Trigger a manual database backup."""
    # Only allow owners/admins if we have such a flag, otherwise any authed user
    try:
        filename = await backup_service.create_backup()
        return {"ok": True, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/backups", response_model=List[Dict])
async def list_backups(current_user: User = Depends(get_current_user)):
    """List all available backups."""
    return backup_service.list_backups()

@router.post("/system/backups/{filename}/restore")
async def restore_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Restore database from a specific backup file."""
    try:
        await backup_service.restore_backup(filename)
        return {"ok": True, "message": "Database restored successfully. Application might need a restart."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/system/backups/{filename}")
async def delete_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Delete a backup file."""
    try:
        backup_service.delete_backup(filename)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/backups/{filename}/download")
async def download_backup(filename: str, current_user: User = Depends(get_current_user)):
    """Download a backup file."""
    filepath = os.path.join(backup_service.backup_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(filepath, filename=filename)

@router.post("/system/import")
async def import_database(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload and import a database backup."""
    # Save the uploaded file temporarily
    temp_path = os.path.join(backup_service.backup_dir, f"upload_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Restore from this file
        await backup_service.restore_backup(os.path.basename(temp_path))
        
        # Cleanup
        os.remove(temp_path)
        return {"ok": True, "message": "Database imported successfully."}
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))
