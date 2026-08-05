"""SQLAlchemy models for the Chat volume.

Schema is a fixed contract relied on by parallel work (chat service, memory
extraction, frontend API client) -- do not rename fields/tables/classes
without coordinating.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

# Message.role values. Only these two are written by the app.
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Derived from the first user message; null until that lands.
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Retrieved knowledge that grounded an assistant reply. Shape:
    # [{"note_id": int, "title": str, "vault_path": str, "score": float}, ...]
    # Null/empty for user messages and for ungrounded replies.
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
