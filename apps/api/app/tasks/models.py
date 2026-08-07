"""SQLAlchemy model for the Tasks volume.

Schema is a fixed contract relied on by parallel work (tasks service,
planner service, frontend API client) -- do not rename fields/tables/
classes without coordinating.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

# Task.status values.
STATUS_TODO = "todo"
STATUS_DOING = "doing"
STATUS_DONE = "done"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional project attribution. SET NULL on project delete so tasks
    # outlive their project (rather than silently vanishing).
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default=STATUS_TODO)
    due_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
