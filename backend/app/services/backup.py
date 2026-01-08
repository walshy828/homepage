"""
BackupService - PostgreSQL Backup & Restore Engine

This service provides comprehensive backup and restore functionality for PostgreSQL
databases. It is designed to be portable across different PostgreSQL versions and
cloud providers.

Key Features:
- Async, non-blocking process execution
- Cross-version SQL sanitization
- Smart retention policy (GFS)
- Detailed diagnostic logging
"""
import os
import asyncio
import logging
import collections
from datetime import datetime
from typing import List, Dict, Tuple
from urllib.parse import urlparse, unquote
from app.core.config import settings

logger = logging.getLogger(__name__)

# SQL commands that are version-specific and may cause cross-version restore failures
# These will be filtered out during the sanitization phase
VERSION_SPECIFIC_COMMANDS = [
    b'SET transaction_timeout',      # PostgreSQL 17+
    b'SET idle_in_transaction_session_timeout',  # May have different defaults
]

# Meta-commands that are proprietary to cloud providers (Supabase, etc.)
PROPRIETARY_META_COMMANDS = [
    b'\\restrict',
    b'\\unrestrict',
]


class BackupService:
    """
    A robust PostgreSQL backup and restore service.
    
    Designed for:
    - Portability between PostgreSQL versions (16, 17, etc.)
    - Compatibility with cloud-managed databases
    - Non-blocking async operation within FastAPI
    """
    
    def __init__(self):
        self.backup_dir = "/app/data/backups"
        self._init_backup_directory()
        
    def _init_backup_directory(self):
        """Initialize and verify the backup directory."""
        try:
            if not os.path.exists(self.backup_dir):
                os.makedirs(self.backup_dir, exist_ok=True)
                logger.info(f"Created backup directory at {self.backup_dir}")
            
            # Verify write permissions
            test_file = os.path.join(self.backup_dir, ".test_write")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            logger.info(f"Backup directory {self.backup_dir} is writable")
            
            # Count existing backups
            backups = [f for f in os.listdir(self.backup_dir) if f.endswith('.sql')]
            logger.info(f"Initialized BackupService. Found {len(backups)} existing backups.")
        except Exception as e:
            logger.error(f"Failed to initialize backup directory: {e}")
        
    def _get_conn_params(self) -> str:
        """Convert the asyncpg URL to a standard postgresql URL."""
        return settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    def _get_postgres_env(self, url: str) -> Tuple[str, dict]:
        """
        Parse the database URL and prepare environment for psql/pg_dump.
        
        Returns:
            Tuple of (clean_url_without_password, env_dict_with_PGPASSWORD)
        """
        parsed = urlparse(url)
        env = os.environ.copy()
        
        username = parsed.username or "homepage"
        password = unquote(parsed.password) if parsed.password else ""
        host = parsed.hostname or "db"
        port = parsed.port or 5432
        db_name = parsed.path.lstrip("/") or "homepage"
        
        if password:
            env["PGPASSWORD"] = password
            
        # Construct a clean URL without password for CLI tools
        clean_url = f"postgresql://{username}@{host}:{port}/{db_name}"
        logger.debug(f"[DB] Prepared connection: host={host}, port={port}, db={db_name}, user={username}")
        return clean_url, env

    async def create_backup(self) -> str:
        """
        Create a new database backup using pg_dump.
        
        The backup is created with flags optimized for portability:
        - --no-owner: Don't dump ownership commands
        - --no-acl: Don't dump access privileges
        - --clean --if-exists: Include DROP statements for clean restore
        - --no-comments: Exclude version-specific comments
        
        Returns:
            Filename of the created backup
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.sql"
        filepath = os.path.join(self.backup_dir, filename)
        
        url = self._get_conn_params()
        logger.info(f"[Backup] Starting database backup to {filename}...")
        
        if url.startswith("sqlite"):
            await self._backup_sqlite(url, filepath)
        else:
            await self._backup_postgres(url, filepath)
        
        # Run retention cleanup
        self.cleanup_backups()
        return filename
    
    async def _backup_sqlite(self, url: str, filepath: str):
        """Create a backup of a SQLite database."""
        db_path = url.split("///")[-1]
        if not os.path.isabs(db_path):
            db_path = os.path.join(os.getcwd(), db_path)
        
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
    
    async def _backup_postgres(self, url: str, filepath: str):
        """Create a backup of a PostgreSQL database using pg_dump."""
        clean_url, env = self._get_postgres_env(url)
        
        try:
            # pg_dump with portability-optimized flags
            process = await asyncio.create_subprocess_exec(
                "pg_dump", 
                "--dbname=" + clean_url, 
                "--file=" + filepath, 
                "--no-owner", 
                "--no-acl",
                "--clean",
                "--if-exists",
                "--no-comments",  # Removes version-specific metadata comments
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error = stderr.decode()
                logger.error(f"[Backup] pg_dump failed (code {process.returncode}): {error}")
                raise Exception(f"Backup failed: {error}")
            
            logger.info(f"[Backup] PostgreSQL backup completed successfully")
        except Exception as e:
            logger.error(f"[Backup] Exception during pg_dump: {str(e)}")
            raise

    def cleanup_backups(self):
        """
        Implement a Grandfather-Father-Son (GFS) retention policy.
        
        Keeps:
        - 1 backup per day for the last N days
        - 1 backup per week for the last N weeks
        - 1 backup per month for the last N months
        - Always keeps the most recent backup
        """
        try:
            backups = self.list_backups()
            if not backups:
                return

            logger.info(f"[Cleanup] Running retention cleanup (total backups: {len(backups)})")
            
            keep_files = set()
            sorted_backups = sorted(backups, key=lambda x: x["created_at"], reverse=True)
            
            # Group by time buckets
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

            # Apply retention policy
            for day in sorted(daily.keys(), reverse=True)[:settings.backup_retention_days]:
                keep_files.add(daily[day][0])

            for week in sorted(weekly.keys(), reverse=True)[:settings.backup_retention_weeks]:
                keep_files.add(weekly[week][0])

            for month in sorted(monthly.keys(), reverse=True)[:settings.backup_retention_months]:
                keep_files.add(monthly[month][0])

            # Always keep the latest
            if sorted_backups:
                keep_files.add(sorted_backups[0]["filename"])

            # Delete files not in keep set
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
        """List all available backup files."""
        backups = []
        try:
            if not os.path.exists(self.backup_dir):
                return backups
                
            for f in os.listdir(self.backup_dir):
                if f.endswith(".sql") and not f.endswith(".sanitized"):
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
        """
        Restore a database from a backup file.
        
        This method performs:
        1. Terminates existing connections to prevent lock conflicts
        2. Sanitizes the SQL file for cross-version compatibility
        3. Executes the restore using psql
        
        Args:
            filename: Name of the backup file to restore
        """
        filepath = os.path.join(self.backup_dir, filename)
        if not os.path.exists(filepath):
            logger.error(f"[Restore] File not found: {filepath}")
            raise Exception(f"Backup file not found: {filename}")
            
        url = self._get_conn_params()
        logger.info(f"[Restore] Starting restoration from {filename}...")
        
        if url.startswith("sqlite"):
            await self._restore_sqlite(url, filepath)
        else:
            await self._restore_postgres(url, filepath, filename)
    
    async def _restore_sqlite(self, url: str, filepath: str):
        """Restore a SQLite database by copying the file."""
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
        
        logger.info("[Restore] SQLite restoration completed")
    
    async def _restore_postgres(self, url: str, filepath: str, filename: str):
        """
        Restore a PostgreSQL database from a SQL dump.
        
        This is the core restoration logic with:
        - Connection termination
        - SQL sanitization for cross-version compatibility
        - Graceful error handling
        """
        clean_url, env = self._get_postgres_env(url)
        db_name = clean_url.split("/")[-1]
        sanitized_path = filepath + ".sanitized"
        
        try:
            # Step 1: Terminate existing connections
            await self._terminate_connections(clean_url, db_name, env)
            
            # Step 2: Sanitize the SQL file
            await self._sanitize_sql_file(filepath, sanitized_path)
            
            # Step 3: Execute the restore
            await self._execute_psql_restore(clean_url, sanitized_path, env, filename)
            
            logger.info(f"[Restore] PostgreSQL restore completed successfully for {filename}")
            
        finally:
            # Always cleanup the sanitized file
            if os.path.exists(sanitized_path):
                os.remove(sanitized_path)
    
    async def _terminate_connections(self, clean_url: str, db_name: str, env: dict):
        """Terminate all other connections to the database to allow schema changes."""
        logger.info(f"[Restore] Terminating existing connections to {db_name}...")
        
        kill_cmd = f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{db_name}' AND pid <> pg_backend_pid();"
        
        process = await asyncio.create_subprocess_exec(
            "psql", "--dbname=" + clean_url, "-c", kill_cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.warning(f"[Restore] Connection termination warning: {stderr.decode()}")
        else:
            logger.info(f"[Restore] Connections terminated successfully")
    
    async def _sanitize_sql_file(self, input_path: str, output_path: str):
        r"""
        Sanitize a SQL dump file for cross-version compatibility.
        
        Removes:
        - Version-specific SET commands (e.g., SET transaction_timeout)
        - Proprietary meta-commands (e.g., \restrict, \unrestrict)
        """
        logger.info(f"[Restore] Sanitizing SQL file for cross-version compatibility...")
        
        lines_filtered = 0
        lines_total = 0
        
        try:
            with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
                for line in f_in:
                    lines_total += 1
                    stripped = line.strip()
                    
                    # Check for proprietary meta-commands
                    skip = False
                    for cmd in PROPRIETARY_META_COMMANDS:
                        if stripped.startswith(cmd):
                            skip = True
                            lines_filtered += 1
                            logger.debug(f"[Sanitize] Filtered meta-command: {stripped[:50]}")
                            break
                    
                    # Check for version-specific SET commands
                    if not skip:
                        for cmd in VERSION_SPECIFIC_COMMANDS:
                            if stripped.startswith(cmd):
                                skip = True
                                lines_filtered += 1
                                logger.debug(f"[Sanitize] Filtered version-specific: {stripped[:50]}")
                                break
                    
                    if not skip:
                        f_out.write(line)
            
            logger.info(f"[Restore] Sanitization complete: {lines_filtered} lines filtered from {lines_total} total")
            
        except Exception as e:
            logger.error(f"[Restore] Sanitization failed: {str(e)}")
            if os.path.exists(output_path):
                os.remove(output_path)
            raise
    
    async def _execute_psql_restore(self, clean_url: str, filepath: str, env: dict, filename: str):
        """
        Execute the psql restore command.
        
        Note: We do NOT use ON_ERROR_STOP for cross-server restores because some
        non-critical warnings are expected (e.g., "relation already exists" during
        a re-restore). However, we log all errors for diagnostic purposes.
        """
        logger.info(f"[Restore] Executing psql restore for {filename}...")
        
        process = await asyncio.create_subprocess_exec(
            "psql", 
            "--dbname=" + clean_url, 
            "--file=" + filepath,
            # Removed --set ON_ERROR_STOP=on for cross-version compatibility
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=600.0  # 10 minute timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            logger.error("[Restore] psql restore timed out after 10 minutes")
            raise Exception("Restore timed out. The database might be too large.")
        
        stdout_text = stdout.decode()
        stderr_text = stderr.decode()
        
        # Log stdout for diagnostics
        if stdout_text:
            logger.debug(f"[Restore] psql stdout: {stdout_text[:500]}")
        
        # Analyze stderr for errors vs warnings
        if stderr_text:
            # Count actual errors vs warnings
            error_lines = [l for l in stderr_text.split('\n') if 'ERROR:' in l]
            warning_lines = [l for l in stderr_text.split('\n') if 'WARNING:' in l or 'NOTICE:' in l]
            
            if error_lines:
                logger.error(f"[Restore] psql errors ({len(error_lines)}): {error_lines[:3]}")
            if warning_lines:
                logger.warning(f"[Restore] psql warnings ({len(warning_lines)}): {warning_lines[:3]}")
        
        # Check return code
        if process.returncode != 0:
            # For cross-version restores, a non-zero return code with only warnings is OK
            if stderr_text and 'ERROR:' in stderr_text:
                # Extract the first actual error message
                error_lines = [l for l in stderr_text.split('\n') if 'ERROR:' in l]
                first_error = error_lines[0] if error_lines else stderr_text[:200]
                logger.error(f"[Restore] Critical error during restore: {first_error}")
                raise Exception(f"Database restore error: {first_error}")
            else:
                # Non-zero return but no ERROR lines - likely just warnings
                logger.warning(f"[Restore] psql returned {process.returncode} but no critical errors found")

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"[Backup] Deleted backup file: {filename}")
        else:
            logger.warning(f"[Backup] File not found for deletion: {filename}")
