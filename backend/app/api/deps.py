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

bearer=HTTPBearer(auto_error=False)
def api_error(status:int,code:str,message:str)->HTTPException:
    return HTTPException(status_code=status,detail={"code":code,"message":message})
async def current_user(credentials:HTTPAuthorizationCredentials|None=Depends(bearer),db:AsyncSession=Depends(get_db))->User:
    if not credentials: raise api_error(401,"AUTH_REQUIRED","Authentication is required.")
    try: user_id=uuid.UUID(decode_access_token(credentials.credentials))
    except (InvalidTokenError,ValueError,KeyError): raise api_error(401,"TOKEN_INVALID","The access token is invalid or expired.")
    user=await db.scalar(select(User).where(User.id==user_id))
    if not user: raise api_error(401,"AUTH_REQUIRED","Authentication is required.")
    return user
async def require_participant(conversation_id:uuid.UUID,user:User,db:AsyncSession)->ConversationParticipant:
    participant=await db.scalar(select(ConversationParticipant).where(ConversationParticipant.conversation_id==conversation_id,ConversationParticipant.user_id==user.id))
    if not participant: raise api_error(403,"CONVERSATION_FORBIDDEN","You do not have access to this conversation.")
    return participant
