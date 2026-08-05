"""SQLAlchemy models for the Memory volume.

Three memory layers, distinguished by `scope`:
  - global:  durable facts about the user (preferences, writing style, role)
  - project: facts scoped to one project (status, decisions, open threads)
  - session: short-lived working context, compressed into the layers above

Schema is a fixed contract relied on by parallel work (chat service, memory
service, frontend API client) -- do not rename fields/tables/classes without
coordinating.
"""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

SCOPE_GLOBAL = "global"
SCOPE_PROJECT = "project"
SCOPE_SESSION = "session"


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    # Free-text project name for scope="project"; null for global/session.
    project: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Same 384-dim space as Note.embedding, so memories are semantically
    # retrievable alongside knowledge. Null until backfilled.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
    # Which conversation this memory was extracted from, when applicable.
    source_conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
