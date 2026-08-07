"""SQLAlchemy model for the Content Studio volume.

Fixed contract — schema shape is relied on by the content service, the
frontend API client, and future assistant-card wiring. Do not rename
fields/tables/classes without coordinating.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

# ContentDraft.kind values. Free-text at the DB layer, but the router/schema
# validates against this exact set via a Literal.
KIND_LINKEDIN = "linkedin"
KIND_BLOG = "blog"
KIND_EMAIL = "email"
KIND_PROPOSAL = "proposal"
KIND_REPORT = "report"
KIND_DECK_OUTLINE = "deck_outline"
KIND_TWEET = "tweet"

# ContentDraft.status values.
STATUS_DRAFT = "draft"
STATUS_FINAL = "final"
STATUS_ARCHIVED = "archived"


class ContentDraft(Base):
    __tablename__ = "content_drafts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # The user's original brief -- what they asked to write.
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # Which output form we generated. See KIND_* above.
    kind: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    # Derived from prompt/body for the list view. Nullable so we can persist
    # early during generation before finalization; filled in on completion.
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The generated draft body (markdown). Nullable so we can persist a row
    # before the LLM call returns; filled in on completion.
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free-text tone hint the user picked (e.g. "professional", "playful",
    # "concise"). Nullable -- when None the kind's default tone is used.
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free-text length hint ("short", "medium", "long"). Nullable = default.
    length: Mapped[str | None] = mapped_column(Text, nullable=True)
    # draft / final / archived. See STATUS_* above.
    status: Mapped[str] = mapped_column(Text, nullable=False, default=STATUS_DRAFT)
    # Optional attribution to a project. SET NULL on project delete so drafts
    # outlive their project (rather than silently vanishing).
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Retrieval grounding: which notes were pulled in for this generation.
    # Same shape as chat's Message.sources so the frontend can reuse chip UI:
    #   [{"note_id": int, "title": str, "vault_path": str, "score": float}, ...]
    sources: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Which conversation this was generated from, if the user hit "generate
    # content from this reply" in the chat UI. Nullable for standalone drafts.
    source_conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    # Model that produced the draft (e.g. "llama-3.3-70b-versatile"). Nullable
    # while the LLM call is in-flight; filled in on completion. Handy for
    # debugging output quality per provider.
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
