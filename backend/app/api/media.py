import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit
from app.models import Attachment, ConversationParticipant, Message, User
from app.schemas.inputs import UploadRequestIn
from app.services.media import r2
router=APIRouter(prefix="/api/media",tags=["media"])
@router.post("/upload-url",dependencies=[Depends(rate_limit("media-upload",40,3600))])
async def upload_url(body:UploadRequestIn,user:User=Depends(current_user)):
    r2.validate(body.kind,body.mime_type,body.file_size);key=r2.key(user.id,body.kind,body.file_name)
    return {"objectKey":key,"uploadUrl":r2.upload_url(key,body.mime_type),"headers":{"Content-Type":body.mime_type},"expiresIn":600}
@router.get("/{attachment_id}/access")
async def media_access(attachment_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    attachment=await db.scalar(select(Attachment).join(Message,Message.id==Attachment.message_id).join(ConversationParticipant,ConversationParticipant.conversation_id==Message.conversation_id).where(Attachment.id==attachment_id,ConversationParticipant.user_id==user.id))
    if not attachment:raise api_error(403,"MEDIA_FORBIDDEN","You do not have access to this attachment.")
    return {"url":r2.access_url(attachment.object_key),"expiresIn":600}
