import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.page_setting import PageSetting


async def get_setting(
    session: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID, page_key: str
) -> Optional[PageSetting]:
    result = await session.execute(
        select(PageSetting).where(
            PageSetting.user_id == user_id,
            PageSetting.workspace_id == workspace_id,
            PageSetting.page_key == page_key,
        )
    )
    return result.scalar_one_or_none()


async def upsert_setting(
    session: AsyncSession,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    page_key: str,
    settings: dict[str, Any],
) -> PageSetting:
    existing = await get_setting(session, user_id, workspace_id, page_key)
    if existing:
        existing.settings = settings
        await session.commit()
        await session.refresh(existing)
        return existing

    setting = PageSetting(
        user_id=user_id,
        workspace_id=workspace_id,
        page_key=page_key,
        settings=settings,
    )
    session.add(setting)
    await session.commit()
    await session.refresh(setting)
    return setting
