import os
import unittest
import uuid
from unittest.mock import AsyncMock, patch

# Ensure test settings can be constructed
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("JWT_ACCESS_SECRET", "12345678901234567890123456789012")
os.environ.setdefault("JWT_REFRESH_SECRET", "12345678901234567890123456789012")
os.environ.setdefault("CLIENT_ORIGINS", '["http://localhost:3000"]')

from app.api import chat as chat_api
from app.models import (
    Conversation,
    ConversationParticipant,
    ConversationType,
    Message,
    MessageReceipt,
    MessageType,
    MessageVisibility,
    User,
    now,
)

class MockScalars:
    def __init__(self, items):
        self.items = list(items)

    def all(self):
        return self.items

class TestChatClearAndDelete(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.user_a = User(id=uuid.uuid4(), display_name="User A", username="usera", email="a@example.com", password_hash="hash")
        self.user_b = User(id=uuid.uuid4(), display_name="User B", username="userb", email="b@example.com", password_hash="hash")
        self.conv_id = uuid.uuid4()
        self.part_a = ConversationParticipant(conversation_id=self.conv_id, user_id=self.user_a.id, pinned=True, muted=True)
        self.part_b = ConversationParticipant(conversation_id=self.conv_id, user_id=self.user_b.id)
        self.msg1 = Message(id=uuid.uuid4(), conversation_id=self.conv_id, sender_id=self.user_a.id, text="hello", created_at=now())
        self.msg2 = Message(id=uuid.uuid4(), conversation_id=self.conv_id, sender_id=self.user_b.id, text="hi there", created_at=now())

    async def test_hide_conversation_messages_creates_visibilities(self):
        from unittest.mock import MagicMock
        db = AsyncMock()
        db.add_all = MagicMock()
        # 1st scalars call: message_ids
        # 2nd scalars call: existing message_ids
        # 3rd scalars call: receipts
        db.scalars.side_effect = [
            MockScalars([self.msg1.id, self.msg2.id]),
            MockScalars([]),
            MockScalars([]),
        ]
        db.get.return_value = self.part_a

        cleared_count = await chat_api.hide_conversation_messages(db, self.conv_id, self.user_a.id)
        self.assertEqual(cleared_count, 2)
        db.add_all.assert_called_once()
        added_objs = db.add_all.call_args[0][0]
        self.assertEqual(len(added_objs), 2)
        for obj in added_objs:
            self.assertIsInstance(obj, MessageVisibility)
            self.assertEqual(obj.user_id, self.user_a.id)

    async def test_clear_conversation_commits_and_emits_socket(self):
        db = AsyncMock()
        with patch.object(chat_api, "require_participant", return_value=self.part_a), \
             patch.object(chat_api, "hide_conversation_messages", return_value=2), \
             patch.object(chat_api, "emit_user", new_callable=AsyncMock) as mock_emit:
            res = await chat_api.clear_conversation(self.conv_id, self.user_a, db)
            self.assertEqual(res, {"cleared": 2})
            db.commit.assert_awaited_once()
            mock_emit.assert_awaited_once_with(self.user_a.id, "conversation:cleared", {"conversationId": str(self.conv_id)})

    async def test_delete_conversation_sets_hidden_commits_and_emits_socket(self):
        db = AsyncMock()
        with patch.object(chat_api, "require_participant", return_value=self.part_a), \
             patch.object(chat_api, "hide_conversation_messages", return_value=2), \
             patch.object(chat_api, "emit_user", new_callable=AsyncMock) as mock_emit:
            res = await chat_api.delete_conversation(self.conv_id, self.user_a, db)
            self.assertTrue(res["deleted"])
            self.assertEqual(res["cleared"], 2)
            self.assertIsNotNone(self.part_a.hidden_at)
            self.assertFalse(self.part_a.pinned)
            self.assertFalse(self.part_a.muted)
            db.commit.assert_awaited_once()
            mock_emit.assert_awaited_once_with(self.user_a.id, "conversation:deleted", {"conversationId": str(self.conv_id)})

if __name__ == "__main__":
    unittest.main()
