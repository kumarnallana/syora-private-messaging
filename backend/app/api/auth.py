from datetime import timedelta
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.config.security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.config.settings import get_settings
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit
from app.models import RefreshSession, User, UserPreference, now
from app.schemas.inputs import LoginIn, RegisterIn
from app.services.serializers import user_out
router=APIRouter(prefix="/api/auth",tags=["auth"]); settings=get_settings(); COOKIE="syora_refresh"

def require_client_origin(request:Request)->None:
    if request.headers.get("origin") not in settings.client_origins:raise api_error(403,"ORIGIN_FORBIDDEN","This request origin is not allowed.")
def set_refresh_cookie(response:Response,token:str):
    response.set_cookie(COOKIE,token,max_age=settings.refresh_token_days*86400,httponly=True,secure=settings.production,samesite="none" if settings.production else "lax",path="/api/auth")
async def payload(db:AsyncSession,user:User)->dict:return {"user":await user_out(db,user,user.id),"accessToken":create_access_token(str(user.id))}
async def issue_session(db:AsyncSession,user:User,response:Response,request:Request)->None:
    raw=new_refresh_token();db.add(RefreshSession(user_id=user.id,token_hash=hash_refresh_token(raw),expires_at=now()+timedelta(days=settings.refresh_token_days),user_agent=(request.headers.get("user-agent") or "")[:300]));await db.commit();set_refresh_cookie(response,raw)

@router.post("/register",dependencies=[Depends(rate_limit("register",1000,3600))],status_code=201)
async def register(body:RegisterIn,response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    email=str(body.email).strip().lower()
    if await db.scalar(select(User.id).where(User.email==email)):raise api_error(409,"EMAIL_EXISTS","An account already exists for this email.")
    if await db.scalar(select(User.id).where(User.username==body.username)):raise api_error(409,"USERNAME_EXISTS","That username is already taken.")
    user=User(display_name=body.display_name,username=body.username,email=email,password_hash=hash_password(body.password));db.add(user);await db.flush();db.add(UserPreference(user_id=user.id));await db.commit();await db.refresh(user);await issue_session(db,user,response,request);return await payload(db,user)
@router.post("/login",dependencies=[Depends(rate_limit("login",1000,900))])
async def login(body:LoginIn,response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    user=await db.scalar(select(User).where(User.email==str(body.email).strip().lower()))
    if not user or not verify_password(user.password_hash,body.password):raise api_error(401,"LOGIN_INVALID","Email or password is incorrect.")
    await issue_session(db,user,response,request);return await payload(db,user)
@router.post("/refresh",dependencies=[Depends(rate_limit("refresh",1000,300))])
async def refresh(response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    raw=request.cookies.get(COOKIE)
    if not raw:raise api_error(401,"REFRESH_REQUIRED","Your session has expired.")
    session=await db.scalar(select(RefreshSession).where(RefreshSession.token_hash==hash_refresh_token(raw),RefreshSession.revoked_at.is_(None),RefreshSession.expires_at>now()).with_for_update())
    if not session:raise api_error(401,"REFRESH_INVALID","Your session has expired.")
    session.revoked_at=now();user=await db.get(User,session.user_id)
    if not user:raise api_error(401,"REFRESH_INVALID","Your session has expired.")
    await issue_session(db,user,response,request);return await payload(db,user)
@router.post("/logout",status_code=204)
async def logout(response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    raw=request.cookies.get(COOKIE)
    if raw:
        session=await db.scalar(select(RefreshSession).where(RefreshSession.token_hash==hash_refresh_token(raw),RefreshSession.revoked_at.is_(None)))
        if session:session.revoked_at=now();await db.commit()
    response.delete_cookie(COOKIE,path="/api/auth",secure=settings.production,samesite="none" if settings.production else "lax")
@router.get("/me")
async def me(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):return await user_out(db,user,user.id)
