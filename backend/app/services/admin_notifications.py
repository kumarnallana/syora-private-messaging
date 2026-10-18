import asyncio
import json
import uuid
from typing import Any

from pywebpush import WebPushException, webpush
from sqlalchemy import select

from app.config.settings import get_settings
from app.db.session import SessionLocal
from app.models import ConversationParticipant, Message, PushSubscription, User, UserPreference, now
from app.realtime.socket import emit_user, session_is_visible

settings = get_settings()


def schedule_failed_login(identifier: str, user_id: uuid.UUID | None = None) -> None:
    task = asyncio.create_task(notify_admins_of_failed_login(identifier, user_id))
    task.add_done_callback(lambda completed: completed.exception() if not completed.cancelled() else None)


def schedule_admin_message(message_id: uuid.UUID) -> None:
    task = asyncio.create_task(notify_admin_recipient(message_id))
    task.add_done_callback(lambda completed: completed.exception() if not completed.cancelled() else None)


def _preference(pref: UserPreference | None, field: str, default: bool = True) -> bool:
    return bool(getattr(pref, field, default))


async def _send_push(subscription: PushSubscription, payload: dict[str, Any]) -> bool:
    if not settings.vapid_public_key or not settings.vapid_private_key:
        return True
    info = {"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}}
    try:
        await asyncio.to_thread(
            webpush,
            subscription_info=info,
            data=json.dumps(payload, separators=(",", ":")),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return True
    except WebPushException as error:
        return not (error.response is not None and error.response.status_code in (404, 410))
    except Exception:
        return True


async def _deliver(admin: User, pref: UserPreference | None, payload: dict[str, Any], conversation_id: uuid.UUID | None = None) -> None:
    try:
        await emit_user(admin.id, "admin:notification", payload)
    except Exception:
        pass
    if not _preference(pref, "admin_push_enabled", False):
        return
    async with SessionLocal() as db:
        subscriptions = list((await db.scalars(select(PushSubscription).where(PushSubscription.user_id == admin.id))).all())
        for subscription in subscriptions:
            if session_is_visible(subscription.session_id):
                continue
            if not await _send_push(subscription, payload):
                await db.delete(subscription)
        await db.commit()


async def notify_admins_of_login(user_id: uuid.UUID) -> None:
    async with SessionLocal() as db:
        member = await db.get(User, user_id)
        if not member or member.role == "admin":
            return
        admins = list((await db.scalars(select(User).where(User.role == "admin"))).all())
        rows = [(admin, await db.get(UserPreference, admin.id)) for admin in admins]
    for admin, pref in rows:
        if not _preference(pref, "admin_login_notifications"):
            continue
        payload = {
            "id": f"login:{user_id}:{uuid.uuid4()}",
            "type": "ADMIN_USER_LOGIN",
            "title": "User logged in",
            "body": f"{member.display_name} (@{member.username}) just signed in.",
            "userId": str(member.id),
            "displayName": member.display_name,
            "username": member.username,
            "timestamp": now().isoformat(),
            "url": "/contacts",
        }
        await _deliver(admin, pref, payload)


def _masked_identifier(identifier: str) -> str:
    local, separator, domain = identifier.strip().lower().partition("@")
    if not separator:
        return "an unknown account"
    visible = local[:2] if len(local) > 1 else local[:1]
    return f"{visible}{'*' * max(2, len(local) - len(visible))}@{domain}"


async def notify_admins_of_failed_login(identifier: str, user_id: uuid.UUID | None = None) -> None:
    async with SessionLocal() as db:
        member = await db.get(User, user_id) if user_id else None
        admins = list((await db.scalars(select(User).where(User.role == "admin"))).all())
        rows = [(admin, await db.get(UserPreference, admin.id)) for admin in admins]
    account = f"@{member.username}" if member and member.role != "admin" else _masked_identifier(identifier)
    for admin, pref in rows:
        if not _preference(pref, "admin_login_notifications"):
            continue
        payload = {
            "id": f"login-failed:{uuid.uuid4()}",
            "type": "ADMIN_LOGIN_FAILED",
            "title": "Failed sign-in attempt",
            "body": f"A sign-in attempt for {account} was rejected.",
            "userId": str(member.id) if member and member.role != "admin" else None,
            "username": member.username if member and member.role != "admin" else None,
            "timestamp": now().isoformat(),
            "url": "/settings",
        }
        await _deliver(admin, pref, payload)


async def notify_admin_recipient(message_id: uuid.UUID) -> None:
    async with SessionLocal() as db:
        message = await db.get(Message, message_id)
        if not message:
            return
        sender = await db.get(User, message.sender_id)
        admins = list((await db.scalars(
            select(User).join(ConversationParticipant, ConversationParticipant.user_id == User.id).where(
                ConversationParticipant.conversation_id == message.conversation_id,
                User.role == "admin",
                User.id != message.sender_id,
            )
        )).all())
        rows = [(admin, await db.get(UserPreference, admin.id)) for admin in admins]
    if not sender:
        return
    for admin, pref in rows:
        if not _preference(pref, "admin_message_notifications"):
            continue
        show_preview = _preference(pref, "admin_message_preview")
        preview = message.text.strip() if message.text else ""
        if not preview:
            preview = "Sent an attachment."
        body = f"{sender.display_name}: {preview}" if show_preview else f"{sender.display_name} sent you a message."
        payload = {
            "id": f"message:{message.id}",
            "type": "ADMIN_DIRECT_MESSAGE",
            "title": "SYORA message",
            "body": body,
            "messageId": str(message.id),
            "conversationId": str(message.conversation_id),
            "senderId": str(sender.id),
            "senderName": sender.display_name,
            "preview": preview if show_preview else None,
            "timestamp": message.created_at.isoformat(),
            "url": f"/chats?conversation={message.conversation_id}",
        }
        await _deliver(admin, pref, payload, message.conversation_id)
