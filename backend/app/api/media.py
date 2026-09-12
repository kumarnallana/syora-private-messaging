import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit
from app.models import Attachment, ConversationParticipant, Message, StatusPost, User, UserPreference, now
from app.schemas.inputs import UploadRequestIn
from app.services.media import r2
from app.services.relationships import accepted, blocked
router=APIRouter(prefix="/api/media",tags=["media"])
@router.post("/upload-url",dependencies=[Depends(rate_limit("media-upload",40,3600))])
async def upload_url(body:UploadRequestIn,user:User=Depends(current_user)):
    r2.validate(body.kind,body.mime_type,body.file_size);key=r2.key(user.id,body.kind,body.file_name)
    return {"objectKey":key,"uploadUrl":r2.upload_url(key,body.mime_type),"headers":{"Content-Type":body.mime_type},"expiresIn":600}
@router.get("/{attachment_id}/access")
async def media_access(attachment_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    attachment=await db.scalar(select(Attachment).join(Message,Message.id==Attachment.message_id).join(ConversationParticipant,ConversationParticipant.conversation_id==Message.conversation_id).where(Attachment.id==attachment_id,ConversationParticipant.user_id==user.id))
    if attachment:
        message=await db.get(Message,attachment.message_id)
        others=(await db.scalars(select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id==message.conversation_id,ConversationParticipant.user_id!=user.id))).all() if message else []
        if any([await blocked(db,user.id,other_id) for other_id in others]):raise api_error(403,"MEDIA_FORBIDDEN","You do not have access to this attachment.")
        return {"url":r2.access_url(attachment.object_key),"expiresIn":600}
    status=await db.get(StatusPost,attachment_id)
    if status and status.object_key and status.expires_at>now():
        allowed=status.user_id==user.id or (await accepted(db,user.id,status.user_id) and not await blocked(db,user.id,status.user_id))
        preference=await db.get(UserPreference,status.user_id)
        if allowed and (status.user_id==user.id or not preference or preference.status_visibility=="Friends"):
            return {"url":r2.access_url(status.object_key),"expiresIn":600}
    raise api_error(403,"MEDIA_FORBIDDEN","You do not have access to this attachment.")
