"""SQLAlchemy model for the Research volume.

Fixed contract — relied on by the research service, the frontend API client,
and the assistant-card "Research this further" wiring. Do not rename
fields/tables/classes without coordinating.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

# ResearchQuery.status values.
STATUS_PENDING = "pending"  # request accepted, LLM call in flight
STATUS_READY = "ready"      # summary available
STATUS_FAILED = "failed"    # LLM failed; sources may still be present


class ResearchQuery(Base):
    __tablename__ = "research_queries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # The user's research question. Free-text, capped by the schema layer.
    query: Mapped[str] = mapped_column(Text, nullable=False)
    # LLM synthesis of retrieved content. Nullable while pending / on failure.
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # pending / ready / failed.
    status: Mapped[str] = mapped_column(Text, nullable=False, default=STATUS_PENDING)
    # Retrieved sources that grounded the answer. Same shape as chat/content
    # Message.sources so the frontend can reuse chip UI:
    #   [{"note_id": int, "title": str, "vault_path": str, "score": float}, ...]
    # Once web search is added later, entries may also carry {"url", "domain"}
    # instead of note_id — frontend distinguishes by presence of note_id.
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Optional attribution to a project (research done in the context of X).
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # If the user hit "save to vault," this is the note row that got created.
    # Note deletion clears this, but the research row stays for history.
    saved_as_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("notes.id", ondelete="SET NULL"), nullable=True
    )
    # Which LLM served the synthesis. Populated on success; null on failure.
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
