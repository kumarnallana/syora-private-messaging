import json
import re
import urllib.parse
import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.config.settings import get_settings
from app.db.session import get_db
from app.models.entities import (
    AIConversation,
    AIMessage,
    Conversation,
    ConversationParticipant,
    ConversationType,
    Friendship,
    FriendshipStatus,
    Message,
    MessageReceipt,
    MessageType,
    User,
    now,
)
from app.realtime.socket import emit_conversation, emit_user
from app.services.ai_assistant import (
    TEMPLATES,
    call_external_llm_if_available,
    extract_recipient_and_channel,
    get_ai_diagnostics,
    match_user_contact,
    refine_message_text,
    synthesize_professional_message,
)
from app.services.serializers import user_out

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequestIn(BaseModel):
    prompt: str = Field(min_length=1)
    previous_draft: str | None = None
    refinement: str | None = None
    recipient_name: str | None = None
    channel: str | None = None


class SendMessageIn(BaseModel):
    conversation_id: str | None = None
    recipient_id: str | None = None
    recipient_name: str
    channel: str = Field(pattern="^(syora|whatsapp|email)$")
    message: str = Field(min_length=1)
    authorized: bool = Field(default=False)
    phone_or_email: str | None = None


class CreateConversationIn(BaseModel):
    title: str = Field(default="New Assistant Chat", max_length=120)


class UpdateConversationIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)


@router.get("/diagnostics")
async def get_diagnostics(user: User = Depends(current_user)):
    return await get_ai_diagnostics(get_settings())


@router.get("/templates")
async def get_templates(user: User = Depends(current_user)):
    return {"templates": TEMPLATES}


@router.get("/contacts")
async def get_ai_contacts(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .join(
            Friendship,
            or_(
                (Friendship.requester_id == user.id) & (
                    Friendship.addressee_id == User.id),
                (Friendship.addressee_id == user.id) & (
                    Friendship.requester_id == User.id),
            ),
        )
        .where(Friendship.status == FriendshipStatus.ACCEPTED)
    )
    result = await db.scalars(stmt)
    contacts = list(result.all())
    items = []
    for c in contacts:
        items.append(await user_out(db, c, user.id))
    return {"contacts": items}


@router.get("/conversations")
async def list_ai_conversations(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(AIConversation).where(AIConversation.user_id ==
                                        user.id).order_by(AIConversation.updated_at.desc())
    convs = (await db.scalars(stmt)).all()
    items = []
    for c in convs:
        latest = await db.scalar(
            select(AIMessage)
            .where(AIMessage.conversation_id == c.id)
            .order_by(AIMessage.created_at.desc())
            .limit(1)
        )
        msg_count = await db.scalar(
            select(func.count()).select_from(AIMessage).where(
                AIMessage.conversation_id == c.id)
        ) or 0
        items.append({
            "id": str(c.id),
            "title": c.title,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "message_count": msg_count,
            "last_message": latest.content[:90] if latest else "",
            "last_draft": latest.draft_message[:90] if (latest and latest.draft_message) else "",
            "last_recipient": latest.recipient_name if latest else "",
            "last_channel": latest.channel if latest else "",
        })
    return items


@router.post("/conversations", status_code=201)
async def create_ai_conversation(body: CreateConversationIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    item = AIConversation(user_id=user.id, title=body.title)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": str(item.id),
        "title": item.title,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


@router.get("/conversations/{conversation_id}")
async def get_ai_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    conv = await db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise api_error(404, "NOT_FOUND", "AI conversation not found.")

    stmt = select(AIMessage).where(AIMessage.conversation_id ==
                                   conversation_id).order_by(AIMessage.created_at.asc())
    messages = (await db.scalars(stmt)).all()
    return {
        "id": str(conv.id),
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "draft_message": m.draft_message,
                "recipient_name": m.recipient_name,
                "recipient_id": str(m.recipient_id) if m.recipient_id else None,
                "channel": m.channel,
                "send_status": m.send_status,
                "metadata": json.loads(m.metadata_json) if m.metadata_json else None,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.patch("/conversations/{conversation_id}")
async def update_ai_conversation(
    conversation_id: uuid.UUID,
    body: UpdateConversationIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise api_error(404, "NOT_FOUND", "AI conversation not found.")
    conv.title = body.title.strip()
    conv.updated_at = now()
    await db.commit()
    return {"id": str(conv.id), "title": conv.title, "updated_at": conv.updated_at.isoformat()}


@router.delete("/conversations/{conversation_id}")
async def delete_ai_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    conv = await db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise api_error(404, "NOT_FOUND", "AI conversation not found.")
    await db.delete(conv)
    await db.commit()
    return {"deleted": True}


@router.post("/conversations/{conversation_id}/chat")
async def chat_with_ai(
    conversation_id: uuid.UUID,
    body: ChatRequestIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(AIConversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise api_error(404, "NOT_FOUND", "AI conversation not found.")

    extracted_recipient, extracted_channel = extract_recipient_and_channel(
        body.prompt)
    target_recipient_name = body.recipient_name or extracted_recipient
    target_channel = body.channel or extracted_channel

    matched_contact = None
    if target_recipient_name:
        matched_contact = await match_user_contact(db, user.id, target_recipient_name)

    recipient_display = matched_contact["name"] if matched_contact else target_recipient_name

    # Check if this prompt is an explicit send command (e.g. "Send this to Rahul on WhatsApp")
    is_send_command = bool(
        re.search(
            r"^(?:please\s+)?(?:send|deliver|forward)\s+(?:this\s+)?(?:message\s+)?(?:to\s+|now|via|on)", body.prompt, re.I)
        or (body.prompt.lower().strip() in {"send", "send it", "send message", "send this", "approve and send"})
    )

    if is_send_command and (body.previous_draft or target_recipient_name):
        draft_to_send = body.previous_draft or "Please review the message."
        # If user says "send it", create an authorization request
        user_msg = AIMessage(
            conversation_id=conversation_id,
            role="user",
            content=body.prompt,
        )
        db.add(user_msg)

        assistant_text = (
            f"I have prepared the message to be sent to **{recipient_display or 'your recipient'}**"
            f"{f' via **{target_channel.title()}**' if target_channel else ''}. "
            f"To protect your privacy and ensure accuracy, Syora requires your explicit authorization before transmitting."
        )

        asst_msg = AIMessage(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_text,
            draft_message=draft_to_send,
            recipient_name=recipient_display,
            recipient_id=uuid.UUID(
                matched_contact["id"]) if matched_contact and matched_contact.get("id") else None,
            channel=target_channel or "syora",
            send_status="pending_approval",
            metadata_json=json.dumps({
                "action": "send_authorization_prompt",
                "recipient": matched_contact,
                "channel": target_channel or "syora",
                "requires_authorization": True,
            }),
        )
        db.add(asst_msg)
        conv.updated_at = now()
        await db.commit()
        await db.refresh(asst_msg)

        return {
            "message_id": str(asst_msg.id),
            "role": "assistant",
            "content": assistant_text,
            "draft_message": draft_to_send,
            "recipient": matched_contact,
            "channel": target_channel or "syora",
            "is_send_command": True,
            "requires_authorization": True,
            "suggested_actions": ["Authorize & Send", "Edit Draft", "Change Channel"],
        }

    # Generate or refine message
    settings = get_settings()
    system_instruction = (
        "You are Syora AI, a world-class professional messaging assistant. "
        "Write concise, polished, professional messages for real-world workplace and networking scenarios. "
        "Return the message draft directly without markdown wrapping unless requested."
    )
    llm_draft, provider_label = await call_external_llm_if_available(system_instruction, body.prompt, settings)

    if llm_draft:
        reasoning = f"I've tailored a professional draft for {recipient_display or 'your recipient'} using {provider_label}. Feel free to review or refine it."
        draft = llm_draft.strip()
        actions = ["Make more concise", "More formal",
                   "Friendlier", "Add clear CTA"]
    else:
        reasoning, draft, actions = synthesize_professional_message(
            user_prompt=body.prompt,
            recipient_name=recipient_display,
            previous_draft=body.previous_draft,
            refinement_instruction=body.refinement,
            sender_name=user.display_name,
        )
        provider_label = "Syora Neural Engine"

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation_id,
        role="user",
        content=body.prompt,
    )
    db.add(user_msg)

    # Save assistant message
    asst_msg = AIMessage(
        conversation_id=conversation_id,
        role="assistant",
        content=reasoning,
        draft_message=draft,
        recipient_name=recipient_display,
        recipient_id=uuid.UUID(
            matched_contact["id"]) if matched_contact and matched_contact.get("id") else None,
        channel=target_channel,
        send_status="draft",
        metadata_json=json.dumps({
            "action": "draft_created",
            "provider": provider_label,
            "recipient": matched_contact,
            "channel": target_channel,
            "suggested_actions": actions,
        }),
    )
    db.add(asst_msg)

    # Update conversation title if first message
    first_title = body.prompt[:40] + ("…" if len(body.prompt) > 40 else "")
    if conv.title == "New Assistant Chat":
        conv.title = first_title
    conv.updated_at = now()

    await db.commit()
    await db.refresh(asst_msg)

    return {
        "message_id": str(asst_msg.id),
        "role": "assistant",
        "content": reasoning,
        "draft_message": draft,
        "provider": provider_label,
        "recipient": matched_contact,
        "channel": target_channel,
        "is_send_command": False,
        "requires_authorization": False,
        "suggested_actions": actions,
    }


def direct_key(a: uuid.UUID, b: uuid.UUID) -> str:
    return ":".join(sorted((str(a), str(b))))


@router.post("/send")
async def send_ai_authorized_message(
    body: SendMessageIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.authorized:
        raise api_error(
            403,
            "AUTHORIZATION_REQUIRED",
            "Outbound message transmission requires explicit user authorization.",
        )

    target_message = body.message.strip()
    if not target_message:
        raise api_error(422, "MESSAGE_EMPTY", "Cannot send an empty message.")

    # Channel 1: In-App Syora Chat
    if body.channel == "syora":
        target_user = None
        if body.recipient_id:
            try:
                target_user = await db.get(User, uuid.UUID(body.recipient_id))
            except Exception:
                pass

        if not target_user and body.recipient_name:
            contact_info = await match_user_contact(db, user.id, body.recipient_name)
            if contact_info and contact_info.get("id"):
                target_user = await db.get(User, uuid.UUID(contact_info["id"]))

        if not target_user:
            raise api_error(
                404,
                "RECIPIENT_NOT_FOUND",
                f"Could not find an active Syora contact matching '{body.recipient_name}'. Make sure they are in your accepted contacts.",
            )

        if target_user.id == user.id:
            raise api_error(422, "SELF_SEND",
                            "You cannot send a message to yourself.")

        # Find or create direct conversation
        key = direct_key(user.id, target_user.id)
        conv = await db.scalar(select(Conversation).where(Conversation.direct_key == key))
        if not conv:
            conv = Conversation(type=ConversationType.DIRECT, direct_key=key)
            db.add(conv)
            await db.flush()
            db.add_all([
                ConversationParticipant(
                    conversation_id=conv.id, user_id=user.id),
                ConversationParticipant(
                    conversation_id=conv.id, user_id=target_user.id),
            ])
            await db.flush()

        new_msg = Message(
            conversation_id=conv.id,
            sender_id=user.id,
            type=MessageType.TEXT,
            text=target_message,
        )
        db.add(new_msg)
        await db.flush()

        conv.last_message_at = now()
        db.add(MessageReceipt(message_id=new_msg.id, user_id=target_user.id))
        await db.commit()

        # Emit realtime update to both parties
        await emit_conversation(
            conv.id,
            "message:new",
            {
                "id": str(new_msg.id),
                "conversationId": str(conv.id),
                "senderId": str(user.id),
                "text": new_msg.text,
                "createdAt": new_msg.created_at.isoformat(),
                "receipt": "sent",
            },
        )
        await emit_user(target_user.id, "conversation:update", {"conversationId": str(conv.id)})

        return {
            "success": True,
            "status": "delivered",
            "channel": "syora",
            "recipient_name": target_user.display_name,
            "recipient_username": target_user.username,
            "conversation_id": str(conv.id),
            "message_id": str(new_msg.id),
            "timestamp": now().isoformat(),
            "confirmation": f"Message sent successfully to {target_user.display_name} in Syora Chat.",
        }

    # Channel 2: WhatsApp
    if body.channel == "whatsapp":
        phone = re.sub(r"[^\d+]", "", body.phone_or_email or "")
        encoded = urllib.parse.quote(target_message)
        if phone:
            wa_url = f"https://api.whatsapp.com/send?phone={phone}&text={encoded}"
        else:
            wa_url = f"https://api.whatsapp.com/send?text={encoded}"

        return {
            "success": True,
            "status": "authorized",
            "channel": "whatsapp",
            "recipient_name": body.recipient_name,
            "external_url": wa_url,
            "timestamp": now().isoformat(),
            "confirmation": f"Authorization verified. Opening WhatsApp with your pre-filled message for {body.recipient_name}.",
        }

    # Channel 3: Email
    if body.channel == "email":
        email_addr = body.phone_or_email or ""
        subject = urllib.parse.quote("Professional Message via Syora")
        encoded_body = urllib.parse.quote(target_message)
        mailto_url = f"mailto:{email_addr}?subject={subject}&body={encoded_body}"

        return {
            "success": True,
            "status": "authorized",
            "channel": "email",
            "recipient_name": body.recipient_name,
            "external_url": mailto_url,
            "timestamp": now().isoformat(),
            "confirmation": f"Authorization verified. Launching email client with your message for {body.recipient_name}.",
        }

    raise api_error(400, "UNSUPPORTED_CHANNEL",
                    f"Channel '{body.channel}' is not supported.")
