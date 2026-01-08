import os
import asyncio
import logging
import re
import collections
from datetime import datetime
from typing import List, Dict
from urllib.parse import urlparse, unquote
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
        """Extract password from URL safely using urllib.parse."""
        parsed = urlparse(url)
        env = os.environ.copy()
        
        # Extract components
        username = parsed.username or "homepage"
        password = unquote(parsed.password) if parsed.password else ""
        host = parsed.hostname or "db"
        port = parsed.port or 5432
        db_name = parsed.path.lstrip("/") or "homepage"
        
        if password:
            env["PGPASSWORD"] = password
            
        # Construct a clean URL without password for psql
        clean_url = f"postgresql://{username}@{host}:{port}/{db_name}"
        return clean_url, env

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
                db_name = clean_url.split("/")[-1]
                logger.info(f"[Restore] Terminating existing connections to {db_name}...")
                
                # Connect to the target DB to kill OTHER connections
                kill_cmd = f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();"
                
                kill_proc = await asyncio.create_subprocess_exec(
                    "psql", "--dbname=" + clean_url, "-c", kill_cmd,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                k_stdout, k_stderr = await kill_proc.communicate()
                if kill_proc.returncode != 0:
                    logger.warning(f"[Restore] Connection termination warning: {k_stderr.decode()}")
                
                # 2. Sanitize the SQL file (remove \restrict if present)
                # We use binary mode for sanitization to prevent UnicodeDecodeErrors with generic dumps
                sanitized_path = filepath + ".sanitized"
                logger.info(f"[Restore] Sanitizing SQL file {filename} (Binary mode)...")
                try:
                    with open(filepath, 'rb') as f_in, open(sanitized_path, 'wb') as f_out:
                        for line in f_in:
                            # Standard pg_dump lines with \restrict start precisely with the backslash
                            if line.startswith(b'\\restrict') or line.startswith(b'\\unrestrict'):
                                continue
                            f_out.write(line)
                    logger.info(f"[Restore] Sanitization complete: {sanitized_path}")
                except Exception as e:
                    logger.error(f"[Restore] Sanitization failed: {str(e)}")
                    if os.path.exists(sanitized_path): os.remove(sanitized_path)
                    raise
                
                # 3. Use non-blocking async psql to run the restore script
                logger.info(f"[Restore] Executing restoration script for {db_name}...")
                process = await asyncio.create_subprocess_exec(
                    "psql", 
                    "--dbname=" + clean_url, 
                    "--file=" + sanitized_path,
                    "--set", "ON_ERROR_STOP=on",
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=600.0) # 10 min timeout
                except asyncio.TimeoutError:
                    process.kill()
                    logger.error(f"[Restore] psql restore timed out after 10 minutes")
                    if os.path.exists(sanitized_path): os.remove(sanitized_path)
                    raise Exception("Restore timed out. The database might be too large or locked.")
                
                # Cleanup sanitized file
                if os.path.exists(sanitized_path): os.remove(sanitized_path)
                
                if process.returncode != 0:
                    error_out = stderr.decode()
                    logger.error(f"[Restore] psql restore failed (code {process.returncode}): {error_out}")
                    # Extract the most relevant part of the error for the user
                    short_error = error_out.split('\n')[-2] if len(error_out.split('\n')) > 1 else error_out
                    raise Exception(f"Database error during restore: {short_error}")
                
                logger.info(f"[Restore] Postgres psql restore completed successfully for {filename}")
            except Exception as e:
                logger.error(f"[Restore] Exception during psql restore: {str(e)}")
                if 'sanitized_path' in locals() and os.path.exists(sanitized_path): os.remove(sanitized_path)
                raise

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"[Backup] Deleted backup file: {filename}")
