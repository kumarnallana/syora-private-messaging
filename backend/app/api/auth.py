from datetime import timedelta
from html import escape
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from jwt import InvalidTokenError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_auth, current_user
from app.config.security import create_access_token, create_password_fingerprint, create_reset_token, decode_reset_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.config.settings import get_settings
import resend
import asyncio
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit
from app.models import PushSubscription, RefreshSession, User, UserPreference, now
from app.schemas.inputs import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn
from app.services.serializers import user_out
from app.services.sessions import AuthenticatedSession, SessionValidationError, idle_expires_at, validate_session
router=APIRouter(prefix="/api/auth",tags=["auth"]); settings=get_settings(); COOKIE="syora_refresh"

def require_client_origin(request:Request)->None:
    if request.headers.get("origin") not in settings.client_origins:raise api_error(403,"ORIGIN_FORBIDDEN","This request origin is not allowed.")
def set_refresh_cookie(response:Response,token:str):
    response.set_cookie(COOKIE,token,max_age=settings.refresh_token_days*86400,httponly=True,secure=settings.production,samesite="none" if settings.production else "lax",path="/api/auth")
async def payload(db:AsyncSession,auth:AuthenticatedSession)->dict:
    return {"user":await user_out(db,auth.user,auth.user.id),"accessToken":create_access_token(str(auth.user.id),str(auth.session.id)),"idleExpiresAt":idle_expires_at(auth)}
async def issue_session(db:AsyncSession,user:User,response:Response,request:Request,last_activity_at=None)->AuthenticatedSession:
    raw=new_refresh_token();session=RefreshSession(user_id=user.id,token_hash=hash_refresh_token(raw),expires_at=now()+timedelta(days=settings.refresh_token_days),last_activity_at=last_activity_at or now(),user_agent=(request.headers.get("user-agent") or "")[:300]);db.add(session);await db.commit();await db.refresh(session);set_refresh_cookie(response,raw);return AuthenticatedSession(user=user,session=session)

@router.post("/register",dependencies=[Depends(rate_limit("register",10,3600))],status_code=201)
async def register(body:RegisterIn,response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    email=str(body.email).strip().lower()
    if await db.scalar(select(User.id).where(User.email==email)):raise api_error(409,"EMAIL_EXISTS","An account already exists for this email.")
    if await db.scalar(select(User.id).where(User.username==body.username)):raise api_error(409,"USERNAME_EXISTS","That username is already taken.")
    user=User(display_name=body.display_name,username=body.username,email=email,password_hash=hash_password(body.password),role="user");db.add(user)
    try:
        await db.flush();db.add(UserPreference(user_id=user.id));await db.commit()
    except IntegrityError:
        await db.rollback()
        if await db.scalar(select(User.id).where(User.email==email)):raise api_error(409,"EMAIL_EXISTS","An account already exists for this email.")
        raise api_error(409,"USERNAME_EXISTS","That username is already taken.")
    await db.refresh(user);auth=await issue_session(db,user,response,request);return await payload(db,auth)
@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot", 5, 300))])
async def forgot_password(body: ForgotPasswordIn, request: Request, db: AsyncSession = Depends(get_db)):
    require_client_origin(request)
    email = str(body.email).strip().lower()
    user = await db.scalar(select(User).where(User.email == email))
    if user:
        token = create_reset_token(str(user.id), user.password_hash)
        base_url = settings.app_frontend_url.rstrip('/')
        reset_link = f"{base_url}/reset-password?token={token}"
        
        if settings.resend_api_key:
            resend.api_key = settings.resend_api_key
            html_content = f"""
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Password Reset</h2>
                <p>Hello {escape(user.display_name)},</p>
                <p>We received a request to reset the password for your Syora account.</p>
                <p><a href="{escape(reset_link, quote=True)}" style="display: inline-block; padding: 10px 20px; background-color: #7b5ea7; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
            """
            params = {
                "from": settings.email_from,
                "to": [email],
                "subject": "Reset your Syora password",
                "html": html_content
            }
            try:
                await asyncio.to_thread(resend.Emails.send, params)
            except Exception:
                print("Password reset email delivery failed.")
        else:
            print("Password reset requested while email delivery is not configured.")
    # Always return a generic success message
    return {"message": "If an account exists for that email, a password reset link has been sent."}

@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 10, 3600))])
async def reset_password(body: ResetPasswordIn, request: Request, db: AsyncSession = Depends(get_db)):
    require_client_origin(request)
    try:
        payload = decode_reset_token(body.token)
        user_id = uuid.UUID(str(payload.get("sub")))
        token_fingerprint = payload.get("psw")
        
        user = await db.scalar(select(User).where(User.id == user_id))
        if not user or create_password_fingerprint(user.password_hash) != token_fingerprint:
            raise api_error(400, "INVALID_TOKEN", "This password reset link is invalid or has already been used.")
            
        # Update the password transactionally
        user.password_hash = hash_password(body.password)
        
        # Invalidate all existing refresh sessions for this user
        from sqlalchemy import delete
        await db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
        
        await db.commit()
        return {"message": "Password updated successfully."}
    except HTTPException:
        raise
    except (InvalidTokenError, KeyError, ValueError):
        raise api_error(400, "INVALID_TOKEN", "This password reset link is invalid or has expired.")

@router.post("/login",dependencies=[Depends(rate_limit("login",20,900))])
async def login(body:LoginIn,response:Response,request:Request,background_tasks:BackgroundTasks,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    user=await db.scalar(select(User).where(User.email==str(body.email).strip().lower()))
    if not user or not verify_password(user.password_hash,body.password):raise api_error(401,"LOGIN_INVALID","Email or password is incorrect.")
    auth=await issue_session(db,user,response,request)
    if user.role!="admin":
        from app.services.admin_notifications import notify_admins_of_login
        background_tasks.add_task(notify_admins_of_login,user.id)
    return await payload(db,auth)
@router.post("/refresh",dependencies=[Depends(rate_limit("refresh",120,300))])
async def refresh(response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    raw=request.cookies.get(COOKIE)
    if not raw:raise api_error(401,"REFRESH_REQUIRED","Your session has expired.")
    session=await db.scalar(select(RefreshSession).where(RefreshSession.token_hash==hash_refresh_token(raw)).with_for_update())
    if not session:raise api_error(401,"REFRESH_INVALID","Your session has expired.")
    try:auth=await validate_session(db,session.user_id,session.id,lock=False)
    except SessionValidationError as error:raise api_error(401,error.code,error.message)
    session.revoked_at=now()
    replacement=await issue_session(db,auth.user,response,request,last_activity_at=session.last_activity_at)
    await db.execute(update(PushSubscription).where(PushSubscription.session_id==session.id).values(session_id=replacement.session.id))
    await db.commit()
    return await payload(db,replacement)
@router.post("/logout",status_code=204)
async def logout(response:Response,request:Request,db:AsyncSession=Depends(get_db)):
    require_client_origin(request)
    raw=request.cookies.get(COOKIE)
    if raw:
        session=await db.scalar(select(RefreshSession).where(RefreshSession.token_hash==hash_refresh_token(raw),RefreshSession.revoked_at.is_(None)))
        if session:
            session.revoked_at=now()
            await db.execute(delete(PushSubscription).where(PushSubscription.session_id==session.id))
            await db.commit()
    response.delete_cookie(COOKIE,path="/api/auth",secure=settings.production,samesite="none" if settings.production else "lax")
@router.get("/me")
async def me(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):return await user_out(db,user,user.id)
@router.post("/activity",dependencies=[Depends(rate_limit("activity",180,3600))])
async def activity(auth:AuthenticatedSession=Depends(current_auth),db:AsyncSession=Depends(get_db)):
    if auth.user.role!="admin":
        auth.session.last_activity_at=now();await db.commit()
    return {"idleExpiresAt":idle_expires_at(auth)}
