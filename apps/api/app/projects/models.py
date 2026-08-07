"""SQLAlchemy model for the Projects volume.

Schema is a fixed contract relied on by parallel work (projects service,
tasks service via project_id FK, planner, frontend API client) -- do not
rename fields/tables/classes without coordinating.
"""

from datetime import datetime

from sqlalchemy import Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.base import Base

STATUS_ACTIVE = "active"
STATUS_ARCHIVED = "archived"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Free-text name. Not unique — the user may reuse a name after archiving.
    # Memory.project references this by name (string), not by FK, so renames
    # are the user's problem to coordinate.
    name: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default=STATUS_ACTIVE)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
