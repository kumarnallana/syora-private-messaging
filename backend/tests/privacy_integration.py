"""Transactional A/B/C authorization verification.

Run from ``backend`` with ``python tests/privacy_integration.py``. The fixture uses
the configured database but keeps all records inside one outer transaction and
rolls it back, so no test accounts or media objects persist.
"""

import asyncio
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import chat, media, status  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.models import (  # noqa: E402
    Attachment,
    Conversation,
    ConversationParticipant,
    ConversationType,
    Friendship,
    FriendshipStatus,
    Message,
    MessageReceipt,
    MessageType,
    StatusPost,
    StatusType,
    User,
    UserPreference,
    now,
)
from app.realtime import socket  # noqa: E402
from app.schemas.inputs import MessageIn  # noqa: E402


async def expect_denied(label: str, expected: int, operation) -> None:
    try:
        await operation()
    except HTTPException as error:
        assert error.status_code == expected, (
            f"{label}: expected {expected}, received {error.status_code}"
        )
    else:
        raise AssertionError(f"{label}: unauthorized operation succeeded")


async def main() -> None:
    suffix = uuid.uuid4().hex[:12]
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        original_session_factory = socket.SessionLocal
        sid = f"privacy-{suffix}"
        try:
            user_a = User(
                display_name="Privacy A",
                username=f"privacy_a_{suffix}",
                email=f"privacy_a_{suffix}@example.com",
                password_hash="not-used",
            )
            user_b = User(
                display_name="Privacy B",
                username=f"privacy_b_{suffix}",
                email=f"privacy_b_{suffix}@example.com",
                password_hash="not-used",
            )
            user_c = User(
                display_name="Privacy C",
                username=f"privacy_c_{suffix}",
                email=f"privacy_c_{suffix}@example.com",
                password_hash="not-used",
            )
            session.add_all([user_a, user_b, user_c])
            await session.flush()
            session.add_all(
                [
                    UserPreference(user_id=user_a.id),
                    UserPreference(user_id=user_b.id),
                    UserPreference(user_id=user_c.id),
                    Friendship(
                        requester_id=user_a.id,
                        addressee_id=user_b.id,
                        status=FriendshipStatus.ACCEPTED,
                    ),
                ]
            )
            conversation = Conversation(
                type=ConversationType.DIRECT,
                direct_key=chat.direct_key(user_a.id, user_b.id),
            )
            session.add(conversation)
            await session.flush()
            session.add_all(
                [
                    ConversationParticipant(
                        conversation_id=conversation.id, user_id=user_a.id
                    ),
                    ConversationParticipant(
                        conversation_id=conversation.id, user_id=user_b.id
                    ),
                ]
            )
            message = Message(
                conversation_id=conversation.id,
                sender_id=user_a.id,
                type=MessageType.TEXT,
                text="Private A-B message",
            )
            session.add(message)
            await session.flush()
            session.add(MessageReceipt(message_id=message.id, user_id=user_b.id))
            attachment = Attachment(
                message_id=message.id,
                object_key=f"users/{user_a.id}/image/{suffix}.png",
                file_name="private.png",
                mime_type="image/png",
                file_size=68,
            )
            private_status = StatusPost(
                user_id=user_a.id,
                type=StatusType.TEXT,
                text="Friends only",
                color="#4c3f66",
                expires_at=now() + timedelta(hours=1),
            )
            session.add_all([attachment, private_status])
            await session.flush()

            await expect_denied(
                "conversation",
                403,
                lambda: chat.get_conversation(conversation.id, user_c, session),
            )
            await expect_denied(
                "messages",
                403,
                lambda: chat.list_messages(conversation.id, None, 30, user_c, session),
            )
            await expect_denied(
                "send",
                403,
                lambda: chat.send_message(
                    conversation.id, MessageIn(text="intrusion"), user_c, session
                ),
            )
            await expect_denied(
                "conversation receipt",
                403,
                lambda: chat.mark_conversation_read(conversation.id, user_c, session),
            )
            await expect_denied(
                "message receipt",
                403,
                lambda: chat.mark_message_read(message.id, user_c, session),
            )
            await expect_denied(
                "media",
                403,
                lambda: media.media_access(attachment.id, user_c, session),
            )
            await expect_denied(
                "status",
                404,
                lambda: status.view_status(private_status.id, user_c, session),
            )

            @asynccontextmanager
            async def shared_session():
                yield session

            socket.SessionLocal = shared_session
            socket.sid_users[sid] = user_c.id
            socket_user, socket_conversation = await socket._authorized(
                sid, str(conversation.id)
            )
            assert socket_user is None and socket_conversation is None, (
                "socket: User C was authorized for the A-B room"
            )
            print("A/B/C privacy checks passed: conversation, messages, send, media, receipts, socket, status")
        finally:
            socket.sid_users.pop(sid, None)
            socket.SessionLocal = original_session_factory
            await session.close()
            await transaction.rollback()


if __name__ == "__main__":
    asyncio.run(main())
