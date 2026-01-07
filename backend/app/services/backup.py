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
        
        # Run retention cleanup
        self.cleanup_backups()
        
        return filename

    def cleanup_backups(self):
        """Implement a smart retention policy for backups."""
        from datetime import datetime, timedelta
        import collections

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

        # 1. Keep ALL backups from the last N days (safest for recent work)
        # However, the user request says "scheduled backups", usually we have one per day.
        # Let's keep one per day for N days.
        days_to_keep = settings.backup_retention_days
        recent_days = sorted(daily.keys(), reverse=True)[:days_to_keep]
        for day in recent_days:
            keep_files.add(daily[day][0]) # Keep the latest backup from that day

        # 2. Keep one backup per week for the last N weeks
        weeks_to_keep = settings.backup_retention_weeks
        recent_weeks = sorted(weekly.keys(), reverse=True)[:weeks_to_keep]
        for week in recent_weeks:
            keep_files.add(weekly[week][0])

        # 3. Keep one backup per month for the last N months
        months_to_keep = settings.backup_retention_months
        recent_months = sorted(monthly.keys(), reverse=True)[:months_to_keep]
        for month in recent_months:
            keep_files.add(monthly[month][0])

        # 4. Always keep the absolute latest backup no matter what
        if sorted_backups:
            keep_files.add(sorted_backups[0]["filename"])

        # Delete any file NOT in the keep set
        for b in backups:
            if b["filename"] not in keep_files:
                try:
                    os.remove(os.path.join(self.backup_dir, b["filename"]))
                    print(f"Cleaned up redundant backup: {b['filename']}")
                except Exception as e:
                    print(f"Failed to delete backup {b['filename']}: {e}")

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
