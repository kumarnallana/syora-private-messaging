from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.api.deps import current_admin
from app.db.session import get_db
from app.models import RefreshSession, User, now
from app.services.sessions import IDLE_TIMEOUT

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/metrics")
async def admin_metrics(
    _: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
):
    current = now()
    signed_in_users = await db.scalar(
        select(func.count(distinct(RefreshSession.user_id)))
        .join(User, User.id == RefreshSession.user_id)
        .where(
            RefreshSession.revoked_at.is_(None),
            RefreshSession.expires_at > current,
            or_(
                User.role == "admin",
                RefreshSession.last_activity_at > current - IDLE_TIMEOUT,
            ),
        )
    )
    return {"signedInUsers": int(signed_in_users or 0)}
