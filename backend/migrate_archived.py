import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    """Manually add the is_archived column if it doesn't exist."""
    async with engine.connect() as conn:
        try:
            # Check if column exists first (SQLite specific check for safety)
            # For PostgreSQL/Generic, wrapping in try/except is effective
            print("Checking/Adding 'is_archived' column to 'notes' table...")
            await conn.execute(text("ALTER TABLE notes ADD COLUMN is_archived BOOLEAN DEFAULT 0"))
            await conn.commit()
            print("Successfully added 'is_archived' column.")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Note: 'is_archived' column already exists, skipping.")
            else:
                print(f"Error during migration: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
