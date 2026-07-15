import json

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.workspace_context import WorkspaceContext, current_workspace
from app.schemas.page_setting import PageSettingRead, PageSettingWrite
from app.services import page_settings_service

router = APIRouter(prefix="/api/page-settings", tags=["page-settings"])

# Settings are free-form JSON; cap the payload so the table can't be abused
# as a blob store.
MAX_SETTINGS_BYTES = 16_384

PAGE_KEY = Path(min_length=1, max_length=100, pattern=r"^[a-z0-9_.:-]+$")


@router.get("/{page_key}", response_model=PageSettingRead)
async def get_page_setting(
    page_key: str = PAGE_KEY,
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    setting = await page_settings_service.get_setting(session, ctx.user_id, ctx.workspace.id, page_key)
    if not setting:
        return PageSettingRead(page_key=page_key, settings={})
    return setting


# Page settings are per-user UI preferences, not workspace data — viewers may
# save their own, so this deliberately uses current_workspace (no write gate).
@router.put("/{page_key}", response_model=PageSettingRead)
async def put_page_setting(
    data: PageSettingWrite,
    page_key: str = PAGE_KEY,
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    if len(json.dumps(data.settings)) > MAX_SETTINGS_BYTES:
        raise HTTPException(status_code=413, detail="Settings payload too large")
    return await page_settings_service.upsert_setting(
        session, ctx.user_id, ctx.workspace.id, page_key, data.settings
    )
