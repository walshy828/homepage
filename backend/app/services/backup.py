import os
import asyncio
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
        
        logger.info(f"[Backup] Starting database backup to {filename}...")
        
        if url.startswith("sqlite"):
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            
            # Use asyncio to copy file (via cat or cp)
            process = await asyncio.create_subprocess_exec(
                "cp", db_path, filepath,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode != 0:
                error = stderr.decode()
                logger.error(f"[Backup] SQLite backup failed: {error}")
                raise Exception(f"Backup failed: {error}")
            
            logger.info("[Backup] SQLite backup completed via file copy")
        else:
            clean_url, env = self._get_postgres_env(url)
            try:
                # Use non-blocking async subprocess
                process = await asyncio.create_subprocess_exec(
                    "pg_dump", 
                    "--dbname=" + clean_url, 
                    "--file=" + filepath, 
                    "--no-owner", 
                    "--no-acl",
                    "--clean",
                    "--if-exists",
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    error = stderr.decode()
                    logger.error(f"[Backup] pg_dump failed (code {process.returncode}): {error}")
                    raise Exception(f"Backup failed: {error}")
                
                logger.info(f"[Backup] Postgres pg_dump completed successfully for {filename}")
            except Exception as e:
                logger.error(f"[Backup] Exception during pg_dump: {str(e)}")
                raise
        
        # Run retention cleanup (can be sync since it's just os.remove)
        self.cleanup_backups()
        return filename

    def cleanup_backups(self):
        """Implement a smart retention policy for backups."""
        try:
            backups = self.list_backups()
            if not backups:
                return

            logger.info(f"[Cleanup] Running retention cleanup (total backups: {len(backups)})")
            
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
                        logger.info(f"[Cleanup] Deleted redundant backup: {b['filename']}")
                    except Exception as e:
                        logger.warning(f"[Cleanup] Failed to delete {b['filename']}: {e}")
        except Exception as e:
            logger.error(f"[Cleanup] Retention cleanup error: {e}")

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
            logger.error(f"[Backup] List backups error: {e}")
        return backups

    async def restore_backup(self, filename: str):
        """Restore a database from a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if not os.path.exists(filepath):
            logger.error(f"[Restore] Restore failed: File not found at {filepath}")
            raise Exception("Backup file not found")
            
        url = self._get_conn_params()
        logger.info(f"[Restore] Starting restoration from {filename}...")
        
        if url.startswith("sqlite"):
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            
            process = await asyncio.create_subprocess_exec(
                "cp", filepath, db_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode != 0:
                error = stderr.decode()
                logger.error(f"[Restore] SQLite restore failed: {error}")
                raise Exception(f"Restore failed: {error}")
            
            logger.info("[Restore] SQLite restoration completed via file copy")
        else:
            clean_url, env = self._get_postgres_env(url)
            try:
                # 1. Kill other connections to prevent locks during DROP/CREATE
                # We need to connect to 'postgres' or another DB to kill connections to this one
                db_name = clean_url.split("/")[-1]
                admin_url = clean_url.rsplit("/", 1)[0] + "/postgres"
                
                logger.info(f"[Restore] Terminating existing connections to {db_name}...")
                kill_cmd = f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();"
                
                kill_proc = await asyncio.create_subprocess_exec(
                    "psql", "--dbname=" + admin_url, "-c", kill_cmd,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await kill_proc.communicate() # We don't strictly check error here as 'postgres' db might not exist or auth might differ
                
                # 2. Use non-blocking async psql to run the restore script
                logger.info(f"[Restore] Executing restoration script for {db_name}...")
                process = await asyncio.create_subprocess_exec(
                    "psql", 
                    "--dbname=" + clean_url, 
                    "--file=" + filepath,
                    "--set", "ON_ERROR_STOP=on",
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                # Use a timeout for the entire communication to avoid infinite hang
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300.0) # 5 min timeout
                except asyncio.TimeoutError:
                    process.kill()
                    logger.error(f"[Restore] psql restore timed out after 5 minutes")
                    raise Exception("Restore timed out. The database might be too large or locked.")
                
                if process.returncode != 0:
                    error = stderr.decode()
                    logger.error(f"[Restore] psql restore failed (code {process.returncode}): {error}")
                    raise Exception(f"Restore failed: {error}")
                
                logger.info(f"[Restore] Postgres psql restore completed successfully for {filename}")
            except Exception as e:
                logger.error(f"[Restore] Exception during psql restore: {str(e)}")
                raise

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"[Backup] Deleted backup file: {filename}")
