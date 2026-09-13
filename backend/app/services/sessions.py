import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshSession, User, now

IDLE_TIMEOUT = timedelta(minutes=5)


class SessionValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class AuthenticatedSession:
    user: User
    session: RefreshSession


def idle_expires_at(auth: AuthenticatedSession) -> str | None:
    if auth.user.role == "admin":
        return None
    return (auth.session.last_activity_at + IDLE_TIMEOUT).isoformat()


async def validate_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    *,
    lock: bool = False,
) -> AuthenticatedSession:
    statement = (
        select(RefreshSession, User)
        .join(User, User.id == RefreshSession.user_id)
        .where(RefreshSession.id == session_id, RefreshSession.user_id == user_id)
    )
    if lock:
        statement = statement.with_for_update()
    row = (await db.execute(statement)).one_or_none()
    if not row:
        raise SessionValidationError("SESSION_INVALID", "Your session is no longer valid.")
    session, user = row
    current = now()
    if session.revoked_at is not None or session.expires_at <= current:
        raise SessionValidationError("SESSION_INVALID", "Your session is no longer valid.")
    if user.role != "admin" and current - session.last_activity_at >= IDLE_TIMEOUT:
        session.revoked_at = current
        await db.commit()
        raise SessionValidationError(
            "SESSION_IDLE_TIMEOUT",
            "Your session ended after 5 minutes of inactivity. Sign in again to continue.",
        )
    return AuthenticatedSession(user=user, session=session)
