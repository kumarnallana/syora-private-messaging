import uuid
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Attachment, Friendship, FriendshipStatus, Message, MessageReceipt, StatusPost, StatusView, User, UserPreference
from app.services.media import r2
from app.realtime.socket import online_users

async def user_out(db:AsyncSession,user:User,viewer_id:uuid.UUID|None=None)->dict:
    own=viewer_id==user.id
    friendship=False
    if viewer_id and not own:
        friendship=bool(await db.scalar(select(Friendship.id).where(Friendship.status==FriendshipStatus.ACCEPTED,or_(and_(Friendship.requester_id==viewer_id,Friendship.addressee_id==user.id),and_(Friendship.addressee_id==viewer_id,Friendship.requester_id==user.id)))))
    pref=await db.get(UserPreference,user.id)
    photo_visibility=(pref.profile_photo_visibility if pref else "Friends").lower()
    seen_visibility=(pref.last_seen_visibility if pref else "Friends").lower()
    show_photo=own or photo_visibility=="everyone" or (photo_visibility=="friends" and friendship)
    show_seen=own or seen_visibility=="everyone" or (seen_visibility=="friends" and friendship)
    avatar=r2.access_url(user.avatar_key) if show_photo and user.avatar_key and r2.configured else None
    return {"id":str(user.id),"name":user.display_name,"email":user.email if own or friendship else "","about":user.about,"avatar":avatar,"color":"iris","online":user.id in online_users if show_seen else False,"lastSeen":user.last_seen_at.isoformat() if show_seen and user.last_seen_at else None}
async def message_out(db:AsyncSession,message:Message,viewer_id:uuid.UUID)->dict:
    attachment=await db.scalar(select(Attachment).where(Attachment.message_id==message.id));receipt="sent"
    if message.sender_id==viewer_id:
        states=(await db.scalars(select(MessageReceipt).where(MessageReceipt.message_id==message.id,MessageReceipt.user_id!=viewer_id))).all()
        readable=False
        for state in states:
            pref=await db.get(UserPreference,state.user_id)
            if state.read_at and (not pref or pref.read_receipts):readable=True
        if readable:receipt="read"
        elif any(x.delivered_at for x in states):receipt="delivered"
    data={"id":str(message.id),"conversationId":str(message.conversation_id),"senderId":str(message.sender_id),"text":"" if message.deleted_at else message.text,"createdAt":message.created_at.isoformat(),"receipt":receipt,"replyTo":str(message.reply_to_message_id) if message.reply_to_message_id else None,"deleted":bool(message.deleted_at)}
    if attachment and not message.deleted_at:data["attachment"]={"id":str(attachment.id),"name":attachment.file_name,"type":message.type.value.lower(),"mime":attachment.mime_type,"size":attachment.file_size,"url":r2.access_url(attachment.object_key) if r2.configured else ""}
    return data
async def status_out(db:AsyncSession,status:StatusPost,viewer_id:uuid.UUID)->dict:
    viewed=[str(v) for v in (await db.scalars(select(StatusView.viewer_id).where(StatusView.status_id==status.id))).all()]
    data={"id":str(status.id),"userId":str(status.user_id),"text":status.text,"color":status.color,"createdAt":status.created_at.isoformat(),"expiresAt":status.expires_at.isoformat(),"viewedBy":viewed}
    if status.object_key:
        kind="video" if status.mime_type and status.mime_type.startswith("video/") else "image";data["attachment"]={"id":str(status.id),"name":status.file_name or "Status media","type":kind,"mime":status.mime_type or "","size":status.file_size or 0,"url":r2.access_url(status.object_key) if r2.configured else ""}
    return data
async def preferences_out(db:AsyncSession,user_id:uuid.UUID)->dict:
    pref=await db.get(UserPreference,user_id)
    if not pref:pref=UserPreference(user_id=user_id);db.add(pref);await db.flush()
    return {"lastSeen":pref.last_seen_visibility,"photo":pref.profile_photo_visibility,"status":pref.status_visibility,"receipts":pref.read_receipts}
