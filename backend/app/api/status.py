import asyncio
import uuid
from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.db.session import get_db
from app.models import Friendship, FriendshipStatus, StatusPost, StatusType, StatusView, User, UserPreference, now
from app.schemas.inputs import StatusIn
from app.services.media import r2
from app.services.serializers import status_out, user_out
from app.realtime.socket import emit_user
router=APIRouter(prefix="/api/status",tags=["status"])

def visible_query(user_id:uuid.UUID):
    accepted=exists(select(Friendship.id).where(Friendship.status==FriendshipStatus.ACCEPTED,or_(and_(Friendship.requester_id==user_id,Friendship.addressee_id==StatusPost.user_id),and_(Friendship.addressee_id==user_id,Friendship.requester_id==StatusPost.user_id))))
    blocked=exists(select(Friendship.id).where(Friendship.status==FriendshipStatus.BLOCKED,or_(and_(Friendship.requester_id==user_id,Friendship.addressee_id==StatusPost.user_id),and_(Friendship.addressee_id==user_id,Friendship.requester_id==StatusPost.user_id))))
    visibility=exists(select(UserPreference.user_id).where(UserPreference.user_id==StatusPost.user_id,UserPreference.status_visibility=="Friends"))
    return and_(StatusPost.expires_at>now(),or_(StatusPost.user_id==user_id,and_(accepted,~blocked,visibility)))
@router.get("")
async def list_status(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.scalars(select(StatusPost).where(visible_query(user.id)).order_by(StatusPost.created_at.desc()))).all();ids={x.user_id for x in rows};people=(await db.scalars(select(User).where(User.id.in_(ids)))).all() if ids else [];return {"users":[await user_out(db,x,user.id) for x in people],"statuses":[await status_out(db,x,user.id) for x in rows]}
@router.post("",status_code=201)
async def create_status(body:StatusIn,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    if not body.text and not body.attachment:raise api_error(422,"STATUS_EMPTY","Add text or media to your status.")
    kind=StatusType.TEXT
    values={}
    if body.attachment:
        if not body.attachment.object_key.startswith(f"users/{user.id}/status/"):raise api_error(422,"STATUS_MEDIA_INVALID","Status upload is invalid.")
        r2.validate_metadata("status",body.attachment.mime_type,body.attachment.file_size)
        await asyncio.to_thread(r2.verify_object,body.attachment.object_key,body.attachment.mime_type,body.attachment.file_size)
        kind=StatusType.VIDEO if body.attachment.mime_type.startswith("video/") else StatusType.IMAGE
        values={"object_key":body.attachment.object_key,"file_name":body.attachment.file_name,"mime_type":body.attachment.mime_type,"file_size":body.attachment.file_size}
    item=StatusPost(user_id=user.id,type=kind,text=body.text,color=body.color,expires_at=now()+timedelta(hours=24),**values);db.add(item);await db.commit();await db.refresh(item);data=await status_out(db,item,user.id)
    pref=await db.get(UserPreference,user.id);rels=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.ACCEPTED,or_(Friendship.requester_id==user.id,Friendship.addressee_id==user.id)))).all()
    if not pref or pref.status_visibility=="Friends":
        for rel in rels:await emit_user(rel.addressee_id if rel.requester_id==user.id else rel.requester_id,"status:new",data)
    return data
@router.delete("/{status_id}",status_code=204)
async def delete_status(status_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    item=await db.scalar(select(StatusPost).where(StatusPost.id==status_id,StatusPost.user_id==user.id))
    if not item:raise api_error(404,"STATUS_NOT_FOUND","Status not found.")
    if item.object_key:await asyncio.to_thread(r2.delete,item.object_key)
    await db.delete(item);await db.commit();rels=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.ACCEPTED,or_(Friendship.requester_id==user.id,Friendship.addressee_id==user.id)))).all()
    for rel in rels:await emit_user(rel.addressee_id if rel.requester_id==user.id else rel.requester_id,"status:deleted",{"statusId":str(status_id)})
@router.post("/{status_id}/view")
async def view_status(status_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    item=await db.scalar(select(StatusPost).where(StatusPost.id==status_id,visible_query(user.id)))
    if not item:raise api_error(404,"STATUS_NOT_FOUND","Status not found.")
    if item.user_id!=user.id and not await db.get(StatusView,{"status_id":status_id,"viewer_id":user.id}):db.add(StatusView(status_id=status_id,viewer_id=user.id));await db.commit()
    return {"viewed":True}
