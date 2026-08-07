"""Shared SQLAlchemy declarative base and table creation.

Every model module in the app must inherit from this one `Base` so that a
single `init_models()` call creates all tables. Adding a new model package
means adding its module to `_MODEL_MODULES` below, otherwise its tables are
never registered on the metadata and never get created.
"""

from importlib import import_module

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import DeclarativeBase

# Imported for their side effect: defining model classes registers them on
# Base.metadata. Kept as strings and imported lazily inside init_models to
# avoid circular imports at module load time.
_MODEL_MODULES = (
    "app.knowledge.models",
    "app.memory.models",
    "app.chat.models",
    "app.projects.models",
    "app.tasks.models",
    "app.content.models",
    "app.research.models",
)


class Base(DeclarativeBase):
    pass


async def init_models(engine: AsyncEngine) -> None:
    """Create all tables if they don't already exist. Safe to call repeatedly."""
    for module in _MODEL_MODULES:
        import_module(module)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
