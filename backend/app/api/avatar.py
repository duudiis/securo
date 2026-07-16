"""Fork addition: profile pictures for the current user.

Stored inline on the users table (see fork_migrations v3) — avatars are
small, capped at 2MB, and always fetched through the authenticated API
(the frontend renders them via an object/data URL).
"""

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.database import get_async_session
from app.models.user import User

router = APIRouter(prefix="/api/users/me/avatar", tags=["users"])

MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


@router.get("")
async def get_avatar(user: User = Depends(current_active_user)):
    if user.avatar is None:
        raise HTTPException(status_code=404, detail="No avatar")
    return Response(
        content=user.avatar,
        media_type=user.avatar_content_type or "image/png",
        headers={"Cache-Control": "private, no-cache"},
    )


@router.put("")
async def upload_avatar(
    file: UploadFile,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported image type")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="Empty file")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 2MB)")
    user.avatar = data
    user.avatar_content_type = file.content_type
    session.add(user)
    await session.commit()
    return {"has_avatar": True}


@router.delete("")
async def delete_avatar(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    user.avatar = None
    user.avatar_content_type = None
    session.add(user)
    await session.commit()
    return {"has_avatar": False}
