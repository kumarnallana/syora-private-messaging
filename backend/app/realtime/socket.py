import asyncio
import uuid
from collections import defaultdict
import socketio
from jwt import InvalidTokenError
from sqlalchemy import select
from app.config.security import decode_access_token
from app.config.settings import get_settings
from app.db.session import SessionLocal
from app.models import ConversationParticipant, Friendship, FriendshipStatus, Message, MessageReceipt, User, UserPreference, now
from app.services.sessions import SessionValidationError, validate_session

settings=get_settings()
sio=socketio.AsyncServer(async_mode="asgi",cors_allowed_origins=settings.client_origins,logger=False,engineio_logger=False)
sio_app=socketio.ASGIApp(sio)
online_users:set[uuid.UUID]=set()
user_sids:dict[uuid.UUID,set[str]]=defaultdict(set)
sid_users:dict[str,uuid.UUID]={}
sid_sessions:dict[str,uuid.UUID]={}
admin_contexts:dict[str,tuple[bool,uuid.UUID|None]]={}
session_watchdogs:dict[str,asyncio.Task]={}
async def conversation_room(conversation_id:uuid.UUID)->str:return f"conversation:{conversation_id}"
async def emit_conversation(conversation_id:uuid.UUID,event:str,data:dict,skip_sid:str|None=None):
    await sio.emit(event,data,room=await conversation_room(conversation_id),skip_sid=skip_sid)
async def emit_user(user_id:uuid.UUID,event:str,data:dict): await sio.emit(event,data,room=f"user:{user_id}")
def session_is_visible(session_id:uuid.UUID)->bool:
    return any(sid_sessions.get(sid)==session_id and context[0] for sid,context in admin_contexts.items())
def session_is_viewing(session_id:uuid.UUID,conversation_id:uuid.UUID|None)->bool:
    return conversation_id is not None and any(sid_sessions.get(sid)==session_id and visible and active==conversation_id for sid,(visible,active) in admin_contexts.items())
async def friend_ids(db,user_id:uuid.UUID)->list[uuid.UUID]:
    rows=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.ACCEPTED,((Friendship.requester_id==user_id)|(Friendship.addressee_id==user_id))))).all()
    return [r.addressee_id if r.requester_id==user_id else r.requester_id for r in rows]

async def _authenticated(sid:str):
    user_id=sid_users.get(sid);session_id=sid_sessions.get(sid)
    if not user_id or not session_id:return None
    async with SessionLocal() as db:
        try:await validate_session(db,user_id,session_id)
        except SessionValidationError:return None
    return user_id

async def _watch_session(sid:str):
    try:
        while sid in sid_users:
            await asyncio.sleep(15)
            user_id=sid_users.get(sid);session_id=sid_sessions.get(sid)
            if not user_id or not session_id:return
            async with SessionLocal() as db:
                try:await validate_session(db,user_id,session_id)
                except SessionValidationError as error:
                    if error.code=="SESSION_IDLE_TIMEOUT":await sio.emit("session:expired",{"code":error.code},to=sid)
                    await sio.disconnect(sid);return
    except asyncio.CancelledError:
        return

@sio.event
async def connect(sid,environ,auth):
    token=auth.get("token") if isinstance(auth,dict) else None
    try:
        claims=decode_access_token(token or "");user_id=uuid.UUID(str(claims["sub"]));session_id=uuid.UUID(str(claims["sid"]))
    except (InvalidTokenError,ValueError,KeyError): raise ConnectionRefusedError("Authentication required")
    async with SessionLocal() as db:
        try:await validate_session(db,user_id,session_id)
        except SessionValidationError:raise ConnectionRefusedError("Authentication required")
        conversations=(await db.scalars(select(ConversationParticipant.conversation_id).where(ConversationParticipant.user_id==user_id))).all()
        friends=await friend_ids(db,user_id);preference=await db.get(UserPreference,user_id)
    sid_users[sid]=user_id;sid_sessions[sid]=session_id;user_sids[user_id].add(sid);online_users.add(user_id)
    session_watchdogs[sid]=asyncio.create_task(_watch_session(sid))
    await sio.enter_room(sid,f"user:{user_id}")
    for conversation_id in conversations: await sio.enter_room(sid,await conversation_room(conversation_id))
    if not preference or preference.last_seen_visibility!="Nobody":
        for friend_id in friends: await emit_user(friend_id,"presence:update",{"userId":str(user_id),"online":True})

@sio.event
async def disconnect(sid):
    user_id=sid_users.pop(sid,None)
    sid_sessions.pop(sid,None)
    admin_contexts.pop(sid,None)
    watchdog=session_watchdogs.pop(sid,None)
    if watchdog and watchdog is not asyncio.current_task():watchdog.cancel()
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
    user_id=await _authenticated(sid)
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
    user_id=await _authenticated(sid)
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

@sio.on("admin:context")
async def admin_context(sid,data):
    user_id=await _authenticated(sid)
    if not user_id:return
    if not isinstance(data,dict):data={}
    async with SessionLocal() as db:user=await db.get(User,user_id)
    if not user or user.role!="admin":return
    conversation_id=None
    try:
        if data.get("conversationId"):conversation_id=uuid.UUID(str(data["conversationId"]))
    except (ValueError,TypeError):
        conversation_id=None
    admin_contexts[sid]=(bool(data.get("visible")),conversation_id)
