import uuid
from collections import defaultdict
import socketio
from jwt import InvalidTokenError
from sqlalchemy import select
from app.config.security import decode_access_token
from app.config.settings import get_settings
from app.db.session import SessionLocal
from app.models import ConversationParticipant, Friendship, FriendshipStatus, Message, MessageReceipt, User, UserPreference, now

settings=get_settings()
sio=socketio.AsyncServer(async_mode="asgi",cors_allowed_origins=[settings.client_origin],logger=False,engineio_logger=False)
online_users:set[uuid.UUID]=set()
user_sids:dict[uuid.UUID,set[str]]=defaultdict(set)
sid_users:dict[str,uuid.UUID]={}
async def conversation_room(conversation_id:uuid.UUID)->str:return f"conversation:{conversation_id}"
async def emit_conversation(conversation_id:uuid.UUID,event:str,data:dict,skip_sid:str|None=None):
    await sio.emit(event,data,room=await conversation_room(conversation_id),skip_sid=skip_sid)
async def emit_user(user_id:uuid.UUID,event:str,data:dict): await sio.emit(event,data,room=f"user:{user_id}")
async def friend_ids(db,user_id:uuid.UUID)->list[uuid.UUID]:
    rows=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.ACCEPTED,((Friendship.requester_id==user_id)|(Friendship.addressee_id==user_id))))).all()
    return [r.addressee_id if r.requester_id==user_id else r.requester_id for r in rows]

@sio.event
async def connect(sid,environ,auth):
    token=auth.get("token") if isinstance(auth,dict) else None
    try: user_id=uuid.UUID(decode_access_token(token or ""))
    except (InvalidTokenError,ValueError,KeyError): raise ConnectionRefusedError("Authentication required")
    async with SessionLocal() as db:
        if not await db.get(User,user_id): raise ConnectionRefusedError("Authentication required")
        conversations=(await db.scalars(select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id==user_id))).all()
        friends=await friend_ids(db,user_id);preference=await db.get(UserPreference,user_id)
    sid_users[sid]=user_id;user_sids[user_id].add(sid);online_users.add(user_id)
    await sio.enter_room(sid,f"user:{user_id}")
    for conversation_id in conversations: await sio.enter_room(sid,await conversation_room(conversation_id))
    if not preference or preference.last_seen_visibility!="Nobody":
        for friend_id in friends: await emit_user(friend_id,"presence:update",{"userId":str(user_id),"online":True})

@sio.event
async def disconnect(sid):
    user_id=sid_users.pop(sid,None)
    if not user_id:return
    user_sids[user_id].discard(sid)
    if user_sids[user_id]:return
    online_users.discard(user_id);user_sids.pop(user_id,None)
    async with SessionLocal() as db:
        user=await db.get(User,user_id); friends=await friend_ids(db,user_id);preference=await db.get(UserPreference,user_id);conversations=(await db.scalars(select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id==user_id))).all()
        if user:user.last_seen_at=now();await db.commit()
    if not preference or preference.last_seen_visibility!="Nobody":
        for friend_id in friends:await emit_user(friend_id,"presence:update",{"userId":str(user_id),"online":False,"lastSeen":now().isoformat()})
    for conversation_id in conversations:await emit_conversation(conversation_id,"typing:stop",{"conversationId":str(conversation_id),"userId":str(user_id)})

async def _authorized(sid:str,conversation_id:str):
    user_id=sid_users.get(sid)
    if not user_id:return None,None
    try: cid=uuid.UUID(conversation_id)
    except ValueError:return None,None
    async with SessionLocal() as db:
        participant=await db.scalar(select(ConversationParticipant).where(ConversationParticipant.conversation_id==cid,ConversationParticipant.user_id==user_id))
        if participant:
            from app.services.relationships import blocked
            others=(await db.scalars(select(ConversationParticipant.user_id).where(ConversationParticipant.conversation_id==cid,ConversationParticipant.user_id!=user_id))).all()
            if any([await blocked(db,user_id,other_id) for other_id in others]):participant=None
    return (user_id,cid) if participant else (None,None)

@sio.on("message:send")
async def socket_message_send(sid,data):
    user_id,cid=await _authorized(sid,str(data.get("conversationId","")))
    if not user_id:return {"ok":False,"error":{"code":"CONVERSATION_FORBIDDEN","message":"You do not have access to this conversation."}}
    try:
        from app.api.chat import send_message
        from app.schemas.inputs import MessageIn
        async with SessionLocal() as db:
            user=await db.get(User,user_id);message=await send_message(cid,MessageIn.model_validate(data),user,db)
        return {"ok":True,"message":message}
    except Exception:
        return {"ok":False,"error":{"code":"MESSAGE_REJECTED","message":"The message could not be sent."}}

@sio.on("typing:start")
async def typing_start(sid,data):
    user_id,cid=await _authorized(sid,str(data.get("conversationId","")))
    if user_id:await emit_conversation(cid,"typing:start",{"conversationId":str(cid),"userId":str(user_id)},sid)
@sio.on("typing:stop")
async def typing_stop(sid,data):
    user_id,cid=await _authorized(sid,str(data.get("conversationId","")))
    if user_id:await emit_conversation(cid,"typing:stop",{"conversationId":str(cid),"userId":str(user_id)},sid)
@sio.on("message:delivered")
async def delivered(sid,data):
    user_id=sid_users.get(sid)
    try: message_id=uuid.UUID(str(data.get("messageId")))
    except (ValueError,TypeError):return
    async with SessionLocal() as db:
        receipt=await db.get(MessageReceipt,{"message_id":message_id,"user_id":user_id}) if user_id else None
        if receipt and not receipt.delivered_at:
            receipt.delivered_at=now();await db.commit()
            message=await db.get(Message,message_id)
            if message:await emit_conversation(message.conversation_id,"message:delivered",{"messageId":str(message_id),"userId":str(user_id)})

@sio.on("conversation:join")
async def join_conversation(sid,data):
    user_id,cid=await _authorized(sid,str(data.get("conversationId","")))
    if user_id:await sio.enter_room(sid,await conversation_room(cid))
