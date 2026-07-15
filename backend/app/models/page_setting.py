import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.core.database import Base


class PageSetting(Base):
    """Per-user, per-workspace UI settings for one page (free-form JSON).

    Fork-owned table: created by app.fork_migrations, NOT by upstream alembic,
    so it never collides with upstream migration revisions.
    """

    __tablename__ = "page_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", "page_key", name="uq_page_settings_user_ws_page"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    page_key: Mapped[str] = mapped_column(String(100))
    settings: Mapped[Optional[Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
