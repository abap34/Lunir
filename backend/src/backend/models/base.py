"""
Database base configuration
"""
from sqlalchemy import create_engine, Column, Integer, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from backend.config import settings

# Convert async database URL to sync for migrations
sync_database_url = settings.database_url.replace("sqlite+aiosqlite://", "sqlite://")

# Async SQLAlchemy setup
async_engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True
)

# Sync SQLAlchemy setup for migrations
sync_engine = create_engine(
    sync_database_url,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

SyncSessionLocal = sessionmaker(
    sync_engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


class TimestampMixin:
    """共通タイムスタンプフィールドを提供するMixin"""
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )


# Database dependency for FastAPI
from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """データベースセッションを取得"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()