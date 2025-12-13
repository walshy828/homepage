
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def add_column():
    async with engine.connect() as conn:
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN tags JSON"))
            await conn.commit()
            print("Successfully added 'tags' column to 'notes' table.")
        except Exception as e:
            print(f"Error adding column (it might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
