from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends
from sqlalchemy import delete

from app.api.deps import api_error, current_admin, current_auth
from app.db.session import get_db
from app.models import PushSubscription, RefreshSession, User, UserPreference, now
from app.schemas.inputs import AdminNotificationPreferencesIn, PushSubscriptionIn
from app.services.sessions import AuthenticatedSession
from app.config.settings import get_settings
from app.services.sessions import IDLE_TIMEOUT

router = APIRouter(prefix="/api/admin", tags=["admin"])
settings = get_settings()


async def notification_settings(db: AsyncSession, user: User, session_id=None) -> dict:
    pref = await db.get(UserPreference, user.id) or UserPreference(user_id=user.id)
    db.add(pref)
    subscription = await db.scalar(select(PushSubscription.id).where(PushSubscription.user_id == user.id, PushSubscription.session_id == session_id).limit(1)) if session_id else None
    await db.commit()
    return {
        "loginAlerts": pref.admin_login_notifications,
        "messageAlerts": pref.admin_message_notifications,
        "messagePreview": pref.admin_message_preview,
        "pushEnabled": pref.admin_push_enabled and bool(subscription),
        "pushSupported": bool(settings.vapid_public_key and settings.vapid_private_key),
        "publicKey": settings.vapid_public_key or None,
    }


@router.get("/notifications")
async def get_notification_settings(auth: AuthenticatedSession = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    if auth.user.role != "admin":
        raise api_error(403, "ADMIN_REQUIRED", "Administrator access is required.")
    return await notification_settings(db, auth.user, auth.session.id)


@router.patch("/notifications")
async def update_notification_settings(body: AdminNotificationPreferencesIn, auth: AuthenticatedSession = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    if auth.user.role != "admin":
        raise api_error(403, "ADMIN_REQUIRED", "Administrator access is required.")
    pref = await db.get(UserPreference, auth.user.id) or UserPreference(user_id=auth.user.id)
    db.add(pref)
    values = body.model_dump(exclude_none=True)
    mapping = {"login_alerts": "admin_login_notifications", "message_alerts": "admin_message_notifications", "message_preview": "admin_message_preview"}
    for key, value in values.items():
        setattr(pref, mapping[key], value)
    await db.commit()
    return await notification_settings(db, auth.user, auth.session.id)


@router.post("/push-subscriptions", status_code=201)
async def save_push_subscription(body: PushSubscriptionIn, auth: AuthenticatedSession = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    if auth.user.role != "admin":
        raise api_error(403, "ADMIN_REQUIRED", "Administrator access is required.")
    item = await db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if item:
        item.user_id = auth.user.id
        item.session_id = auth.session.id
        item.p256dh = body.keys.p256dh
        item.auth = body.keys.auth
    else:
        db.add(PushSubscription(user_id=auth.user.id, session_id=auth.session.id, endpoint=body.endpoint, p256dh=body.keys.p256dh, auth=body.keys.auth))
    pref = await db.get(UserPreference, auth.user.id) or UserPreference(user_id=auth.user.id)
    pref.admin_push_enabled = True
    db.add(pref)
    await db.commit()
    return await notification_settings(db, auth.user, auth.session.id)


@router.delete("/push-subscriptions", status_code=204)
async def remove_push_subscription(auth: AuthenticatedSession = Depends(current_auth), db: AsyncSession = Depends(get_db)):
    if auth.user.role != "admin":
        raise api_error(403, "ADMIN_REQUIRED", "Administrator access is required.")
    await db.execute(delete(PushSubscription).where(PushSubscription.user_id == auth.user.id, PushSubscription.session_id == auth.session.id))
    remaining = await db.scalar(select(PushSubscription.id).where(PushSubscription.user_id == auth.user.id).limit(1))
    pref = await db.get(UserPreference, auth.user.id)
    if pref and not remaining:
        pref.admin_push_enabled = False
    await db.commit()


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
