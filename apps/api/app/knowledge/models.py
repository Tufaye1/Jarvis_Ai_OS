"""SQLAlchemy models for the Knowledge volume's vault-ingestion slice.

Schema is a fixed contract relied on by other in-progress work (embeddings
task, etc.) -- do not rename fields/tables/classes without coordinating.
"""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vault_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class NoteLink(Base):
    __tablename__ = "note_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_note_id: Mapped[int] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    target_title: Mapped[str] = mapped_column(Text, nullable=False)
    target_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("notes.id"), nullable=True
    )
