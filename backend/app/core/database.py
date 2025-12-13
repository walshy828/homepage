"""
Homepage Dashboard - Database Configuration
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency for getting database sessions."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def run_migrations():
    """Run Alembic migrations."""
    import asyncio
    from alembic import command
    from alembic.config import Config
    
    # Run migrations in a separate thread to avoid blocking event loop
    def run_upgrade():
        try:
            print("Running Alembic migrations...")
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            print("Alembic migrations completed successfully.")
        except Exception as e:
            print(f"Error running Alembic migrations: {e}")
            import traceback
            traceback.print_exc()
            # Don't silence the error, let it propagate but log it first
            raise
        
    await asyncio.to_thread(run_upgrade)


async def init_db():
    """Initialize database tables via Alembic."""
    await run_migrations()
    # async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.create_all)
