import os
import subprocess
import logging
import re
import collections
from datetime import datetime
from typing import List, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self):
        self.backup_dir = "/app/data/backups"
        try:
            if not os.path.exists(self.backup_dir):
                os.makedirs(self.backup_dir, exist_ok=True)
                logger.info(f"Created backup directory at {self.backup_dir}")
            
            # Verify permissions
            test_file = os.path.join(self.backup_dir, ".test_write")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            logger.info(f"Backup directory {self.backup_dir} is writable")
            
            backups = os.listdir(self.backup_dir)
            logger.info(f"Initialized BackupService. Found {len([f for f in backups if f.endswith('.sql')])} existing backups.")
        except Exception as e:
            logger.error(f"Failed to initialize backup directory: {e}")
        
    def _get_conn_params(self):
        # postgresql+asyncpg://homepage:homepage@db:5432/homepage
        return settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    def _get_postgres_env(self, url: str):
        """Extract password from URL and return a clean URL + env with PGPASSWORD."""
        # Pattern to find password in postgresql://user:pass@host...
        match = re.search(r"postgresql://(?P<user>[^:]+):(?P<pass>[^@]+)@(?P<host>[^:/]+)(:(?P<port>\d+))?/(?P<db>.+)", url)
        env = os.environ.copy()
        if match:
            password = match.group("pass")
            env["PGPASSWORD"] = password
            # Construct a URL without the password for safer tool invocation
            clean_url = f"postgresql://{match.group('user')}@{match.group('host')}:{match.group('port') or '5432'}/{match.group('db')}"
            return clean_url, env
        return url, env

    async def create_backup(self) -> str:
        """Create a new database backup."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.sql"
        filepath = os.path.join(self.backup_dir, filename)
        
        url = self._get_conn_params()
        
        logger.info(f"Starting database backup to {filename}...")
        
        if url.startswith("sqlite"):
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            subprocess.run(["cp", db_path, filepath], check=True)
            logger.info("SQLite backup completed via file copy")
        else:
            clean_url, env = self._get_postgres_env(url)
            try:
                # --clean and --if-exists ensure the restore script drops objects before creating them
                result = subprocess.run(
                    [
                        "pg_dump", 
                        "--dbname=" + clean_url, 
                        "--file=" + filepath, 
                        "--no-owner", 
                        "--no-acl",
                        "--clean",
                        "--if-exists"
                    ],
                    env=env,
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"Postgres pg_dump completed successfully for {filename}")
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr or str(e)
                logger.error(f"pg_dump failed: {error_msg}")
                raise Exception(f"Backup failed: {error_msg}")
        
        # Run retention cleanup
        self.cleanup_backups()
        return filename

    def cleanup_backups(self):
        """Implement a smart retention policy for backups."""
        try:
            backups = self.list_backups()
            if not backups:
                return

            logger.info(f"Running retention cleanup (total backups: {len(backups)})")
            
            # Retention buckets
            keep_files = set()
            sorted_backups = sorted(backups, key=lambda x: x["created_at"], reverse=True)
            
            daily = collections.defaultdict(list)
            weekly = collections.defaultdict(list)
            monthly = collections.defaultdict(list)
            
            for b in sorted_backups:
                try:
                    dt = datetime.fromisoformat(b["created_at"])
                    daily[dt.strftime("%Y-%m-%d")].append(b["filename"])
                    weekly[dt.strftime("%Y-%U")].append(b["filename"])
                    monthly[dt.strftime("%Y-%m")].append(b["filename"])
                except Exception:
                    continue

            # Keep strategies
            recent_days = sorted(daily.keys(), reverse=True)[:settings.backup_retention_days]
            for day in recent_days: keep_files.add(daily[day][0])

            recent_weeks = sorted(weekly.keys(), reverse=True)[:settings.backup_retention_weeks]
            for week in recent_weeks: keep_files.add(weekly[week][0])

            recent_months = sorted(monthly.keys(), reverse=True)[:settings.backup_retention_months]
            for month in recent_months: keep_files.add(monthly[month][0])

            if sorted_backups:
                keep_files.add(sorted_backups[0]["filename"])

            # Delete redundant
            for b in backups:
                if b["filename"] not in keep_files:
                    try:
                        os.remove(os.path.join(self.backup_dir, b["filename"]))
                        logger.info(f"Deleted redundant backup: {b['filename']}")
                    except Exception as e:
                        logger.warning(f"Failed to delete {b['filename']}: {e}")
        except Exception as e:
            logger.error(f"Retention cleanup error: {e}")

    def list_backups(self) -> List[Dict]:
        """List all available backups."""
        backups = []
        try:
            if not os.path.exists(self.backup_dir):
                return backups
                
            for f in os.listdir(self.backup_dir):
                if f.endswith(".sql"):
                    path = os.path.join(self.backup_dir, f)
                    try:
                        stats = os.stat(path)
                        backups.append({
                            "filename": f,
                            "size": stats.st_size,
                            "created_at": datetime.fromtimestamp(stats.st_mtime).isoformat()
                        })
                    except Exception:
                        continue
            
            backups.sort(key=lambda x: x["created_at"], reverse=True)
        except Exception as e:
            logger.error(f"List backups error: {e}")
        return backups

    async def restore_backup(self, filename: str):
        """Restore a database from a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if not os.path.exists(filepath):
            logger.error(f"Restore failed: File not found at {filepath}")
            raise Exception("Backup file not found")
            
        url = self._get_conn_params()
        logger.info(f"Starting restoration from {filename}...")
        
        if url.startswith("sqlite"):
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            subprocess.run(["cp", filepath, db_path], check=True)
            logger.info("SQLite restoration completed via file copy")
        else:
            clean_url, env = self._get_postgres_env(url)
            try:
                # Use psql to restore .sql files
                result = subprocess.run(
                    [
                        "psql", 
                        "--dbname=" + clean_url, 
                        "--file=" + filepath,
                        "--set", "ON_ERROR_STOP=on"
                    ],
                    env=env,
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"Postgres psql restore completed successfully for {filename}")
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr or str(e)
                logger.error(f"psql restore failed: {error_msg}")
                raise Exception(f"Restore failed: {error_msg}")

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Deleted backup file: {filename}")
