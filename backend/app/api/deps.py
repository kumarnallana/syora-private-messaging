import uuid
from datetime import UTC, datetime, timedelta
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.security import decode_access_token
from app.db.session import get_db
from app.models import ConversationParticipant, User
from app.services.sessions import AuthenticatedSession, SessionValidationError, validate_session

bearer=HTTPBearer(auto_error=False)
def api_error(status:int,code:str,message:str)->HTTPException:
    return HTTPException(status_code=status,detail={"code":code,"message":message})
async def current_auth(credentials:HTTPAuthorizationCredentials|None=Depends(bearer),db:AsyncSession=Depends(get_db))->AuthenticatedSession:
    if not credentials: raise api_error(401,"AUTH_REQUIRED","Authentication is required.")
    try:
        token=decode_access_token(credentials.credentials)
        user_id=uuid.UUID(str(token["sub"]));session_id=uuid.UUID(str(token["sid"]))
    except (InvalidTokenError,ValueError,KeyError): raise api_error(401,"TOKEN_INVALID","The access token is invalid or expired.")
    try:return await validate_session(db,user_id,session_id)
    except SessionValidationError as error:raise api_error(401,error.code,error.message)
async def current_user(auth:AuthenticatedSession=Depends(current_auth))->User:return auth.user
async def current_admin(user:User=Depends(current_user))->User:
    if user.role!="admin":raise api_error(403,"ADMIN_REQUIRED","Administrator access is required.")
    return user
async def require_participant(conversation_id:uuid.UUID,user:User,db:AsyncSession)->ConversationParticipant:
    participant=await db.scalar(select(ConversationParticipant).where(ConversationParticipant.conversation_id==conversation_id,ConversationParticipant.user_id==user.id))
    if not participant: raise api_error(403,"CONVERSATION_FORBIDDEN","You do not have access to this conversation.")
    return participant
