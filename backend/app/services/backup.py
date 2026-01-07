import os
import subprocess
from datetime import datetime
from typing import List, Dict
from app.core.config import settings

class BackupService:
    def __init__(self):
        self.backup_dir = "/app/data/backups"
        os.makedirs(self.backup_dir, exist_ok=True)
        
    def _get_conn_params(self):
        # postgresql+asyncpg://homepage:homepage@db:5432/homepage
        url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        # We also need to handle cases where it might be sqlite for local dev
        return url

    async def create_backup(self) -> str:
        """Create a new database backup."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.sql"
        filepath = os.path.join(self.backup_dir, filename)
        
        url = self._get_conn_params()
        
        if url.startswith("sqlite"):
            # Handle sqlite backup simply by copying the file
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            subprocess.run(["cp", db_path, filepath], check=True)
        else:
            # Postgres backup
            env = os.environ.copy()
            # If the URL has password, pg_dump might handle it via connection string
            # Form: postgresql://user:pass@host:port/dbname
            try:
                subprocess.run(
                    ["pg_dump", "--dbname=" + url, "--file=" + filepath, "--no-owner", "--no-acl"],
                    env=env,
                    check=True,
                    capture_output=True
                )
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.decode()
                raise Exception(f"Backup failed: {error_msg}")
        
        return filename

    def list_backups(self) -> List[Dict]:
        """List all available backups."""
        backups = []
        if not os.path.exists(self.backup_dir):
            return backups
            
        for f in os.listdir(self.backup_dir):
            if f.endswith(".sql"):
                path = os.path.join(self.backup_dir, f)
                stats = os.stat(path)
                backups.append({
                    "filename": f,
                    "size": stats.st_size,
                    "created_at": datetime.fromtimestamp(stats.st_ctime).isoformat()
                })
        
        # Sort by creation time descending
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return backups

    async def restore_backup(self, filename: str):
        """Restore a database from a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if not os.path.exists(filepath):
            raise Exception("Backup file not found")
            
        url = self._get_conn_params()
        
        if url.startswith("sqlite"):
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            subprocess.run(["cp", filepath, db_path], check=True)
        else:
            # Postgres restore
            # Note: This might require dropping and recreating the database or using --clean
            # For simplicity, we assume we can just run the SQL
            try:
                # We use psql to restore .sql files created by pg_dump
                subprocess.run(
                    ["psql", "--dbname=" + url, "--file=" + filepath],
                    check=True,
                    capture_output=True
                )
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.decode()
                raise Exception(f"Restore failed: {error_msg}")

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
