"""End-to-End AI Integration Test Suite.

Tests all Syora AI capabilities:
1. Multi-provider diagnostics
2. Scenario templates
3. Conversation session creation
4. Natural language prompt processing & message drafting
5. Tone refinements (formal, concise, friendly)
6. Session rename & enriched conversation history indicators (message_count, snippet, recipient)
7. Send authorization enforcement (blocks unauthorized send, validates WhatsApp/Email/Syora channels)
8. User isolation & access authorization (cross-user access blocked)
9. Session deletion & cleanup

Run with:
    .venv\\Scripts\\python.exe tests/ai_integration.py
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.ai import (
    ChatRequestIn,
    CreateConversationIn,
    SendMessageIn,
    UpdateConversationIn,
    chat_with_ai,
    create_ai_conversation,
    delete_ai_conversation,
    get_ai_contacts,
    get_ai_conversation,
    get_diagnostics,
    get_templates,
    list_ai_conversations,
    send_ai_authorized_message,
    update_ai_conversation,
)
from app.db.session import engine
from app.models import Friendship, FriendshipStatus, User


async def expect_error(label: str, expected_status: int, coro):
    try:
        await coro
    except HTTPException as e:
        assert e.status_code == expected_status, f"{label}: expected {expected_status}, got {e.status_code}"
    else:
        raise AssertionError(f"{label}: expected HTTPException {expected_status}, but call succeeded")


async def run_ai_integration_tests():
    suffix = uuid.uuid4().hex[:8]
    print(f"\n=======================================================")
    print(f"🚀 Running Syora AI End-to-End Integration Test Suite ({suffix})")
    print(f"=======================================================\n")

    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        try:
            # 1. Setup Test Users
            user_a = User(
                display_name=f"Syora User {suffix}",
                username=f"syora_user_{suffix}",
                email=f"user_{suffix}@example.com",
                password_hash="test-hash",
            )
            user_b = User(
                display_name="Rahul Sharma",
                username=f"rahul_{suffix}",
                email=f"rahul_{suffix}@example.com",
                password_hash="test-hash",
            )
            user_intruder = User(
                display_name="Intruder",
                username=f"intruder_{suffix}",
                email=f"intruder_{suffix}@example.com",
                password_hash="test-hash",
            )
            session.add_all([user_a, user_b, user_intruder])
            await session.flush()

            # Create friendship between user_a and Rahul
            friendship = Friendship(
                requester_id=user_a.id,
                addressee_id=user_b.id,
                status=FriendshipStatus.ACCEPTED,
            )
            session.add(friendship)
            await session.flush()
            print("✅ Step 1: Test users and friendship created successfully.")

            # 2. Test Diagnostics Endpoint
            diag = await get_diagnostics(user=user_a)
            assert "active_provider" in diag, "Missing active_provider in diagnostics"
            assert "provider_name" in diag, "Missing provider_name in diagnostics"
            assert "gemini" in diag, "Missing gemini in diagnostics"
            assert "ollama" in diag, "Missing ollama in diagnostics"
            assert "builtin" in diag, "Missing builtin in diagnostics"
            print(f"✅ Step 2: Diagnostics endpoint verified (Active Provider: {diag['active_provider']}).")

            # 3. Test Templates Endpoint
            tpl_res = await get_templates(user=user_a)
            templates = tpl_res.get("templates", [])
            assert len(templates) >= 6, f"Expected at least 6 templates, got {len(templates)}"
            print(f"✅ Step 3: Scenario templates verified ({len(templates)} templates loaded).")

            # 4. Test Contacts Matching
            contacts_res = await get_ai_contacts(user=user_a, db=session)
            contacts = contacts_res.get("contacts", [])
            assert len(contacts) == 1, f"Expected 1 contact for user_a, got {len(contacts)}"
            assert contacts[0]["name"] == "Rahul Sharma"
            print("✅ Step 4: Contact discovery and privacy filtering verified.")

            # 5. Create AI Conversation Session
            conv_summary = await create_ai_conversation(
                body=CreateConversationIn(title="New Assistant Chat"),
                user=user_a,
                db=session,
            )
            conv_id = uuid.UUID(conv_summary["id"])
            assert conv_summary["title"] == "New Assistant Chat"
            print(f"✅ Step 5: Created conversation session: {conv_id}")

            # 6. Test AI Chat Prompt (Natural Prompt + Recipient Extraction)
            chat_req_1 = ChatRequestIn(
                prompt="Ask Rahul for a status update on the confidential web backend",
            )
            chat_res_1 = await chat_with_ai(
                conversation_id=conv_id,
                body=chat_req_1,
                user=user_a,
                db=session,
            )
            assert chat_res_1["draft_message"], "Expected AI to generate draft message"
            assert "Rahul" in (chat_res_1["draft_message"] + str(chat_res_1.get("recipient"))), "Recipient not reflected"
            assert len(chat_res_1["suggested_actions"]) > 0, "Expected suggested refinement actions"
            print(f"✅ Step 6: AI Chat generation succeeded:")
            print(f"   Draft snippet: {chat_res_1['draft_message'][:70]}...")

            # 7. Test Tone Refinement
            chat_req_2 = ChatRequestIn(
                prompt="Make it more concise and formal",
                previous_draft=chat_res_1["draft_message"],
                refinement="formal and concise",
            )
            chat_res_2 = await chat_with_ai(
                conversation_id=conv_id,
                body=chat_req_2,
                user=user_a,
                db=session,
            )
            assert chat_res_2["draft_message"], "Expected refined draft"
            print("✅ Step 7: Tone refinement succeeded.")

            # 8. Test Session Rename
            rename_res = await update_ai_conversation(
                conversation_id=conv_id,
                body=UpdateConversationIn(title="Rahul Status Update Project"),
                user=user_a,
                db=session,
            )
            assert rename_res["title"] == "Rahul Status Update Project"
            print("✅ Step 8: Inline session rename verified.")

            # 9. Test Enriched History Listing
            convs_list = await list_ai_conversations(user=user_a, db=session)
            assert len(convs_list) == 1
            item = convs_list[0]
            assert item["id"] == str(conv_id)
            assert item["title"] == "Rahul Status Update Project"
            assert item["message_count"] == 4, f"Expected 4 messages, got {item['message_count']}"
            assert len(item["last_draft"]) > 0, "Expected last_draft snippet"
            print(f"✅ Step 9: Enriched conversation history verified (count: {item['message_count']}, snippet: {item['last_draft'][:35]}...)")

            # 10. Test Authorization: Block Unauthorized Send Attempt
            unauthorized_send = SendMessageIn(
                conversation_id=str(conv_id),
                recipient_name="Rahul",
                channel="whatsapp",
                message="Here is the update",
                authorized=False,
            )
            await expect_error(
                "Unauthorized send attempt",
                403,
                send_ai_authorized_message(body=unauthorized_send, user=user_a, db=session),
            )
            print("✅ Step 10A: Security authorization check enforced (blocked unauthorized dispatch).")

            # 11. Test Authorized Sends:
            # WhatsApp Channel
            wa_send = SendMessageIn(
                conversation_id=str(conv_id),
                recipient_name="Rahul",
                channel="whatsapp",
                message="Hi Rahul, please check the project status when possible.",
                authorized=True,
                phone_or_email="+15551234567",
            )
            wa_res = await send_ai_authorized_message(body=wa_send, user=user_a, db=session)
            assert wa_res["success"] is True
            assert wa_res["channel"] == "whatsapp"
            assert "api.whatsapp.com" in wa_res["external_url"]
            print("✅ Step 10B: Authorized WhatsApp dispatch verified.")

            # Email Channel
            email_send = SendMessageIn(
                conversation_id=str(conv_id),
                recipient_name="Rahul",
                channel="email",
                message="Hi Rahul, please check the project status.",
                authorized=True,
                phone_or_email="rahul@example.com",
            )
            email_res = await send_ai_authorized_message(body=email_send, user=user_a, db=session)
            assert email_res["success"] is True
            assert email_res["channel"] == "email"
            assert "mailto:rahul@example.com" in email_res["external_url"]
            print("✅ Step 10C: Authorized Email dispatch verified.")

            # In-App Syora Chat Channel
            syora_send = SendMessageIn(
                conversation_id=str(conv_id),
                recipient_id=str(user_b.id),
                recipient_name="Rahul Sharma",
                channel="syora",
                message="Hi Rahul, sending this via Syora chat directly.",
                authorized=True,
            )
            syora_res = await send_ai_authorized_message(body=syora_send, user=user_a, db=session)
            assert syora_res["success"] is True
            assert syora_res["channel"] == "syora"
            assert syora_res["conversation_id"] is not None
            print(f"✅ Step 10D: Authorized in-app Syora direct chat dispatch verified (Conversation: {syora_res['conversation_id']}).")

            # 12. Cross-User Privacy & Isolation
            await expect_error(
                "Intruder accessing conversation",
                404,
                get_ai_conversation(conversation_id=conv_id, user=user_intruder, db=session),
            )
            await expect_error(
                "Intruder deleting conversation",
                404,
                delete_ai_conversation(conversation_id=conv_id, user=user_intruder, db=session),
            )
            print("✅ Step 11: Cross-user privacy isolation verified (404 on unauthorized access).")

            # 13. Delete Conversation Session
            del_res = await delete_ai_conversation(conversation_id=conv_id, user=user_a, db=session)
            assert del_res["deleted"] is True
            convs_after = await list_ai_conversations(user=user_a, db=session)
            assert len(convs_after) == 0
            print("✅ Step 12: Session deletion and cleanup verified.")

            print("\n=======================================================")
            print("🎉 ALL 12 END-TO-END AI INTEGRATION TESTS PASSED!")
            print("=======================================================\n")

        finally:
            await transaction.rollback()
            print("🧹 Transaction rolled back: Database remains 100% clean.")


if __name__ == "__main__":
    asyncio.run(run_ai_integration_tests())
