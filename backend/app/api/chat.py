import asyncio
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user, require_participant
from app.db.session import get_db
from app.models import Attachment, Conversation, ConversationParticipant, ConversationType, Friendship, FriendshipStatus, Message, MessageReceipt, MessageType, MessageVisibility, User, UserPreference, now
from app.schemas.inputs import ConversationPreferenceIn, DeleteMessageIn, DirectConversationIn, MessageIn
from app.services.media import r2
from app.services.relationships import blocked
from app.services.serializers import message_out, user_out
from app.realtime.socket import emit_conversation, emit_user

router = APIRouter(tags=["chat"])


def direct_key(a: uuid.UUID, b: uuid.UUID) -> str:
    return ":".join(sorted((str(a), str(b))))


async def conversation_out(db: AsyncSession, conversation: Conversation, participant: ConversationParticipant, user_id: uuid.UUID) -> dict:
    other_id = await db.scalar(select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id == conversation.id, ConversationParticipant.user_id != user_id))
    other = await db.get(User, other_id) if other_id else None
    unread = await db.scalar(select(func.count()).select_from(MessageReceipt).join(Message, Message.id == MessageReceipt.message_id).where(Message.conversation_id == conversation.id, MessageReceipt.user_id == user_id, MessageReceipt.read_at.is_(None))) or 0
    latest = await db.scalar(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).limit(1))
    return {"id": str(conversation.id), "participants": [str(user_id), str(other_id)] if other_id else [str(user_id)], "unread": unread, "pinned": participant.pinned, "muted": participant.muted, "typing": False, "participant": await user_out(db, other, user_id) if other else None, "latestMessage": await message_out(db, latest, user_id) if latest else None}


@router.get("/api/conversations")
async def list_conversations(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Conversation, ConversationParticipant).join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id).where(ConversationParticipant.user_id == user.id).order_by(ConversationParticipant.pinned.desc(), Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc()))).all()
    return [await conversation_out(db, c, p, user.id) for c, p in rows]


@router.post("/api/conversations/direct", status_code=201)
async def create_direct(body: DirectConversationIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if body.user_id == user.id:
        raise api_error(422, "CONVERSATION_SELF",
                        "You cannot start a conversation with yourself.")
    rel = await db.scalar(select(Friendship).where(Friendship.status == FriendshipStatus.ACCEPTED, or_(and_(Friendship.requester_id == user.id, Friendship.addressee_id == body.user_id), and_(Friendship.requester_id == body.user_id, Friendship.addressee_id == user.id))))
    if not rel:
        raise api_error(403, "FRIENDSHIP_REQUIRED",
                        "An accepted friendship is required.")
    if await blocked(db, user.id, body.user_id):
        raise api_error(403, "CONTACT_BLOCKED",
                        "This conversation is unavailable.")
    key = direct_key(user.id, body.user_id)
    existing = await db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if existing:
        return await conversation_out(db, existing, await require_participant(existing.id, user, db), user.id)
    item = Conversation(type=ConversationType.DIRECT, direct_key=key)
    db.add(item)
    await db.flush()
    db.add_all([ConversationParticipant(conversation_id=item.id, user_id=user.id),
                ConversationParticipant(conversation_id=item.id, user_id=body.user_id)])
    await db.commit()
    participant = await require_participant(item.id, user, db)
    data = await conversation_out(db, item, participant, user.id)
    await emit_user(body.user_id, "conversation:update", {"conversationId": str(item.id)})
    return data


@router.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    participant = await require_participant(conversation_id, user, db)
    item = await db.get(Conversation, conversation_id)
    if not item:
        raise api_error(404, "CONVERSATION_NOT_FOUND",
                        "Conversation not found.")
    return await conversation_out(db, item, participant, user.id)


@router.patch("/api/conversations/{conversation_id}")
async def set_conversation_preferences(conversation_id: uuid.UUID, body: ConversationPreferenceIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    participant = await require_participant(conversation_id, user, db)
    if body.pinned is not None:
        participant.pinned = body.pinned
    if body.muted is not None:
        participant.muted = body.muted
    await db.commit()
    return {"pinned": participant.pinned, "muted": participant.muted}


@router.get("/api/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: uuid.UUID, before: datetime | None = None, limit: int = Query(30, ge=1, le=100), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await require_participant(conversation_id, user, db)
    query = select(Message).where(Message.conversation_id == conversation_id, ~Message.id.in_(
        select(MessageVisibility.message_id).where(MessageVisibility.user_id == user.id)))
    if before:
        query = query.where(Message.created_at < before)
    rows = (await db.scalars(query.order_by(Message.created_at.desc()).limit(limit))).all()
    rows = list(rows)
    rows.reverse()
    return {"messages": [await message_out(db, x, user.id) for x in rows], "nextCursor": rows[0].created_at.isoformat() if len(rows) == limit else None}


@router.post("/api/conversations/{conversation_id}/messages", status_code=201)
async def send_message(conversation_id: uuid.UUID, body: MessageIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await require_participant(conversation_id, user, db)
    participant_ids = (await db.scalars(select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id == conversation_id))).all()
    other_ids = [x for x in participant_ids if x != user.id]
    if any([await blocked(db, user.id, x) for x in other_ids]):
        raise api_error(403, "CONTACT_BLOCKED",
                        "Messages cannot be sent in this conversation.")
    if not body.text and not body.attachment:
        raise api_error(422, "MESSAGE_EMPTY", "Add text or an attachment.")
    if body.reply_to and not await db.scalar(select(Message.id).where(Message.id == body.reply_to, Message.conversation_id == conversation_id)):
        raise api_error(422, "REPLY_INVALID",
                        "The reply target is not in this conversation.")
    message_type = MessageType.TEXT
    if body.attachment:
        if not body.attachment.object_key.startswith(f"users/{user.id}/"):
            raise api_error(422, "ATTACHMENT_INVALID",
                            "Attachment upload is invalid.")
        message_type = MessageType.IMAGE if body.attachment.mime_type.startswith(
            "image/") else MessageType.VIDEO if body.attachment.mime_type.startswith("video/") else MessageType.DOCUMENT
        r2.validate_metadata(message_type.value.lower(
        ), body.attachment.mime_type, body.attachment.file_size)
        await asyncio.to_thread(r2.verify_object, body.attachment.object_key, body.attachment.mime_type, body.attachment.file_size)
    item = Message(conversation_id=conversation_id, sender_id=user.id,
                   type=message_type, text=body.text, reply_to_message_id=body.reply_to)
    db.add(item)
    await db.flush()
    if body.attachment:
        db.add(Attachment(message_id=item.id, object_key=body.attachment.object_key, file_name=body.attachment.file_name, mime_type=body.attachment.mime_type,
                          file_size=body.attachment.file_size, width=body.attachment.width, height=body.attachment.height, duration=body.attachment.duration))
    db.add_all([MessageReceipt(message_id=item.id, user_id=x)
                for x in other_ids])
    conversation = await db.get(Conversation, conversation_id)
    if conversation:
        conversation.last_message_at = item.created_at
    await db.commit()
    from app.services.admin_notifications import schedule_admin_message
    schedule_admin_message(item.id)
    data = await message_out(db, item, user.id)
    await emit_conversation(conversation_id, "message:new", data)
    for other_id in other_ids:
        await emit_user(other_id, "conversation:update", {"conversationId": str(conversation_id)})
    return data


@router.delete("/api/messages/{message_id}")
async def delete_message(message_id: uuid.UUID, body: DeleteMessageIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    item = await db.scalar(select(Message).where(Message.id == message_id))
    if not item:
        raise api_error(404, "MESSAGE_NOT_FOUND", "Message not found.")
    await require_participant(item.conversation_id, user, db)
    if body.mode == "me":
        if not await db.get(MessageVisibility, {"message_id": item.id, "user_id": user.id}):
            db.add(MessageVisibility(message_id=item.id, user_id=user.id))
    else:
        if item.sender_id != user.id:
            raise api_error(403, "MESSAGE_DELETE_FORBIDDEN",
                            "You can only delete your own message for everyone.")
        attachment = await db.scalar(select(Attachment).where(Attachment.message_id == item.id))
        item.text = ""
        item.reply_to_message_id = None
        item.deleted_at = now()
        if attachment:
            await asyncio.to_thread(r2.delete, attachment.object_key)
            await db.delete(attachment)
    await db.commit()
    if body.mode == "everyone":
        await emit_conversation(item.conversation_id, "message:deleted", {"messageId": str(item.id)})
    return {"deleted": True, "mode": body.mode}


async def mark_read_internal(message: Message, user: User, db: AsyncSession):
    await require_participant(message.conversation_id, user, db)
    receipt = await db.get(MessageReceipt, {"message_id": message.id, "user_id": user.id})
    if receipt and not receipt.read_at:
        receipt.delivered_at = receipt.delivered_at or now()
        receipt.read_at = now()
        participant = await db.get(ConversationParticipant, {"conversation_id": message.conversation_id, "user_id": user.id})
        if participant:
            participant.last_read_message_id = message.id
        preference = await db.get(UserPreference, user.id)
        await db.commit()
        if not preference or preference.read_receipts:
            await emit_conversation(message.conversation_id, "message:read", {"messageId": str(message.id), "userId": str(user.id)})


@router.post("/api/messages/{message_id}/read")
async def mark_message_read(message_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    item = await db.get(Message, message_id)
    if not item:
        raise api_error(404, "MESSAGE_NOT_FOUND", "Message not found.")
    await mark_read_internal(item, user, db)
    return {"read": True}


@router.post("/api/conversations/{conversation_id}/read")
async def mark_conversation_read(conversation_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await require_participant(conversation_id, user, db)
    items = (await db.scalars(select(Message).join(MessageReceipt, MessageReceipt.message_id == Message.id).where(Message.conversation_id == conversation_id, MessageReceipt.user_id == user.id, MessageReceipt.read_at.is_(None)))).all()
    for item in items:
        receipt = await db.get(MessageReceipt, {"message_id": item.id, "user_id": user.id})
        if receipt:
            receipt.delivered_at = receipt.delivered_at or now()
            receipt.read_at = now()
    if items:
        participant = await db.get(ConversationParticipant, {"conversation_id": conversation_id, "user_id": user.id})
        if participant:
            participant.last_read_message_id = items[-1].id
        preference = await db.get(UserPreference, user.id)
        await db.commit()
        if not preference or preference.read_receipts:
            await emit_conversation(conversation_id, "message:read", {"messageIds": [str(x.id) for x in items], "userId": str(user.id)})
    return {"read": len(items)}
