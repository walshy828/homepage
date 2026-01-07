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
        return settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    def _get_postgres_env(self, url: str):
        """Extract password from URL and return a clean URL + env with PGPASSWORD."""
        import re
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
        
        if url.startswith("sqlite"):
            # Handle sqlite backup simply by copying the file
            db_path = url.split("///")[-1]
            if not os.path.isabs(db_path):
                db_path = os.path.join(os.getcwd(), db_path)
            subprocess.run(["cp", db_path, filepath], check=True)
        else:
            # Postgres backup
            clean_url, env = self._get_postgres_env(url)
            try:
                # --clean and --if-exists ensure the restore script drops objects before creating them
                subprocess.run(
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
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr or str(e)
                raise Exception(f"Backup failed: {error_msg}")
        
        # Run retention cleanup
        self.cleanup_backups()
        
        return filename

    def cleanup_backups(self):
        """Implement a smart retention policy for backups."""
        from datetime import datetime, timedelta
        import collections

        try:
            backups = self.list_backups()
            if not backups:
                return

            now = datetime.now()
            
            # Retention buckets
            keep_files = set()
            
            # Sort backups by date (newest first)
            sorted_backups = sorted(backups, key=lambda x: x["created_at"], reverse=True)
            
            # Group backups by buckets
            daily = collections.defaultdict(list)
            weekly = collections.defaultdict(list)
            monthly = collections.defaultdict(list)
            
            for b in sorted_backups:
                try:
                    dt = datetime.fromisoformat(b["created_at"])
                    
                    # Daily bucket (date only)
                    day_key = dt.strftime("%Y-%m-%d")
                    daily[day_key].append(b["filename"])
                    
                    # Weekly bucket (year + week number)
                    week_key = dt.strftime("%Y-%U")
                    weekly[week_key].append(b["filename"])
                    
                    # Monthly bucket (year + month)
                    month_key = dt.strftime("%Y-%m")
                    monthly[month_key].append(b["filename"])
                except Exception:
                    continue

            # 1. Keep one per day for N days
            days_to_keep = settings.backup_retention_days
            recent_days = sorted(daily.keys(), reverse=True)[:days_to_keep]
            for day in recent_days:
                keep_files.add(daily[day][0])

            # 2. Keep one per week for N weeks
            weeks_to_keep = settings.backup_retention_weeks
            recent_weeks = sorted(weekly.keys(), reverse=True)[:weeks_to_keep]
            for week in recent_weeks:
                keep_files.add(weekly[week][0])

            # 3. Keep one per month for N months
            months_to_keep = settings.backup_retention_months
            recent_months = sorted(monthly.keys(), reverse=True)[:months_to_keep]
            for month in recent_months:
                keep_files.add(monthly[month][0])

            # 4. Always keep the absolute latest backup
            if sorted_backups:
                keep_files.add(sorted_backups[0]["filename"])

            # Delete any file NOT in the keep set
            for b in backups:
                if b["filename"] not in keep_files:
                    try:
                        os.remove(os.path.join(self.backup_dir, b["filename"]))
                    except Exception as e:
                        print(f"Failed to delete backup {b['filename']}: {e}")
        except Exception as e:
            print(f"Retention cleanup error: {e}")

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
            
            # Sort by creation time descending
            backups.sort(key=lambda x: x["created_at"], reverse=True)
        except Exception as e:
            print(f"List backups error: {e}")
            
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
            # For SQLite, we just overwrite the DB file
            subprocess.run(["cp", filepath, db_path], check=True)
        else:
            # Postgres restore
            clean_url, env = self._get_postgres_env(url)
            try:
                # Use psql to restore .sql files
                # --set ON_ERROR_STOP=on ensures we stop if SQL execution fails
                subprocess.run(
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
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr or str(e)
                raise Exception(f"Restore failed: {error_msg}")

    def delete_backup(self, filename: str):
        """Delete a backup file."""
        filepath = os.path.join(self.backup_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
