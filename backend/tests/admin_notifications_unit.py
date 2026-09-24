import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException

from app.api import admin as admin_api
from app.models import Message, MessageType, User, UserPreference, now
from app.schemas.inputs import PushSubscriptionIn
from app.services import admin_notifications


class ScalarRows:
    def __init__(self, rows): self.rows = rows
    def all(self): return self.rows


class FakeSession:
    def __init__(self, values, rows): self.values = values; self.rows = rows
    async def __aenter__(self): return self
    async def __aexit__(self, *_): return None
    async def get(self, model, key): return self.values.get((model, key))
    async def scalars(self, _): return ScalarRows(self.rows)


def user(role="user", name="Member", username="member"):
    return User(id=uuid.uuid4(), display_name=name, username=username, email=f"{username}@example.com", password_hash="hash", role=role, about="")


class AdminNotificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_member_cannot_register_admin_push_subscription(self):
        member = user()
        auth = SimpleNamespace(user=member, session=SimpleNamespace(id=uuid.uuid4()))
        body = PushSubscriptionIn(endpoint="https://push.example/subscription", keys={"p256dh": "key", "auth": "auth"})
        with self.assertRaises(HTTPException) as raised:
            await admin_api.save_push_subscription(body, auth, AsyncMock())
        self.assertEqual(raised.exception.status_code, 403)

    async def test_member_login_notifies_admin_once(self):
        member, admin = user(), user("admin", "Admin", "admin")
        pref = UserPreference(user_id=admin.id, admin_login_notifications=True)
        db = FakeSession({(User, member.id): member, (UserPreference, admin.id): pref}, [admin])
        deliver = AsyncMock()
        with patch.object(admin_notifications, "SessionLocal", return_value=db), patch.object(admin_notifications, "_deliver", deliver):
            await admin_notifications.notify_admins_of_login(member.id)
        deliver.assert_awaited_once()
        self.assertEqual(deliver.await_args.args[2]["type"], "ADMIN_USER_LOGIN")

    async def test_admin_login_does_not_notify_admin(self):
        admin = user("admin", "Admin", "admin")
        db = FakeSession({(User, admin.id): admin}, [admin])
        deliver = AsyncMock()
        with patch.object(admin_notifications, "SessionLocal", return_value=db), patch.object(admin_notifications, "_deliver", deliver):
            await admin_notifications.notify_admins_of_login(admin.id)
        deliver.assert_not_awaited()

    async def test_failed_member_login_notifies_admin_without_password_data(self):
        member, admin = user(), user("admin", "Admin", "admin")
        pref = UserPreference(user_id=admin.id, admin_login_notifications=True)
        db = FakeSession({(User, member.id): member, (UserPreference, admin.id): pref}, [admin])
        deliver = AsyncMock()
        with patch.object(admin_notifications, "SessionLocal", return_value=db), patch.object(admin_notifications, "_deliver", deliver):
            await admin_notifications.notify_admins_of_failed_login(member.email, member.id)
        payload = deliver.await_args.args[2]
        self.assertEqual(payload["type"], "ADMIN_LOGIN_FAILED")
        self.assertIn("@member", payload["body"])
        self.assertNotIn(member.email, payload["body"])

    async def test_direct_admin_message_respects_preview_setting(self):
        sender, admin = user(), user("admin", "Admin", "admin")
        message = Message(id=uuid.uuid4(), conversation_id=uuid.uuid4(), sender_id=sender.id, text="private preview", type=MessageType.TEXT, created_at=now())
        pref = UserPreference(user_id=admin.id, admin_message_notifications=True, admin_message_preview=False)
        db = FakeSession({(Message, message.id): message, (User, sender.id): sender, (UserPreference, admin.id): pref}, [admin])
        deliver = AsyncMock()
        with patch.object(admin_notifications, "SessionLocal", return_value=db), patch.object(admin_notifications, "_deliver", deliver):
            await admin_notifications.notify_admin_recipient(message.id)
        payload = deliver.await_args.args[2]
        self.assertNotIn("private preview", payload["body"])
        self.assertIsNone(payload["preview"])

    async def test_member_to_member_message_creates_no_admin_event(self):
        sender = user()
        message = Message(id=uuid.uuid4(), conversation_id=uuid.uuid4(), sender_id=sender.id, text="members only", type=MessageType.TEXT, created_at=now())
        db = FakeSession({(Message, message.id): message, (User, sender.id): sender}, [])
        deliver = AsyncMock()
        with patch.object(admin_notifications, "SessionLocal", return_value=db), patch.object(admin_notifications, "_deliver", deliver):
            await admin_notifications.notify_admin_recipient(message.id)
        deliver.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
