import asyncio
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import api_error, current_user
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit
from app.models import Friendship, FriendshipStatus, User, UserPreference
from app.schemas.inputs import FriendRequestIn, FriendResponseIn, PreferencesIn, ProfileIn
from app.services.relationships import pair_clause, relationship
from app.services.serializers import preferences_out, user_out
router=APIRouter(tags=["users"])
def friendship_out(item:Friendship)->dict:return {"id":str(item.id),"from":str(item.requester_id),"to":str(item.addressee_id),"status":item.status.value.lower()}

@router.get("/api/users/search")
async def search_users(q:str=Query(min_length=1,max_length=80),limit:int=Query(20,ge=1,le=30),user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rows=(await db.scalars(select(User).where(User.id!=user.id,User.display_name.ilike(f"%{q.strip()}%")).order_by(User.display_name).limit(limit))).all();return [await user_out(db,x,user.id) for x in rows]
@router.get("/api/contacts")
async def contacts(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rels=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.ACCEPTED,or_(Friendship.requester_id==user.id,Friendship.addressee_id==user.id)))).all();ids=[r.addressee_id if r.requester_id==user.id else r.requester_id for r in rels];people=(await db.scalars(select(User).where(User.id.in_(ids)))).all() if ids else [];return {"users":[await user_out(db,x,user.id) for x in people],"friendships":[friendship_out(x) for x in rels]}
@router.get("/api/friend-requests")
async def friend_requests(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    rels=(await db.scalars(select(Friendship).where(Friendship.status==FriendshipStatus.PENDING,or_(Friendship.requester_id==user.id,Friendship.addressee_id==user.id)))).all();ids={x.requester_id for x in rels}|{x.addressee_id for x in rels};ids.discard(user.id);people=(await db.scalars(select(User).where(User.id.in_(ids)))).all() if ids else [];return {"users":[await user_out(db,x,user.id) for x in people],"friendships":[friendship_out(x) for x in rels]}
@router.post("/api/friend-requests",dependencies=[Depends(rate_limit("friend-request",30,3600))],status_code=201)
async def request_friend(body:FriendRequestIn,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    if body.user_id==user.id:raise api_error(422,"FRIEND_SELF","You cannot send a friend request to yourself.")
    if not await db.get(User,body.user_id):raise api_error(404,"USER_NOT_FOUND","User not found.")
    existing=await relationship(db,user.id,body.user_id)
    if existing and existing.status==FriendshipStatus.DECLINED:
        existing.requester_id=user.id;existing.addressee_id=body.user_id;existing.status=FriendshipStatus.PENDING;await db.commit();return friendship_out(existing)
    if existing:raise api_error(409,"RELATIONSHIP_EXISTS","A relationship already exists with this user.")
    item=Friendship(requester_id=user.id,addressee_id=body.user_id,status=FriendshipStatus.PENDING);db.add(item);await db.commit();await db.refresh(item);return friendship_out(item)
@router.patch("/api/friend-requests/{request_id}")
async def respond_friend(request_id:uuid.UUID,body:FriendResponseIn,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    item=await db.scalar(select(Friendship).where(Friendship.id==request_id,Friendship.addressee_id==user.id,Friendship.status==FriendshipStatus.PENDING).with_for_update())
    if not item:raise api_error(404,"REQUEST_NOT_FOUND","Friend request not found.")
    item.status=FriendshipStatus.ACCEPTED if body.action=="accept" else FriendshipStatus.DECLINED;await db.commit();return friendship_out(item)
@router.delete("/api/contacts/{other_id}",status_code=204)
async def remove_contact(other_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    item=await db.scalar(select(Friendship).where(pair_clause(user.id,other_id),Friendship.status==FriendshipStatus.ACCEPTED))
    if not item:raise api_error(404,"CONTACT_NOT_FOUND","Contact not found.")
    await db.delete(item);await db.commit()
@router.post("/api/blocks/{other_id}")
async def block_user(other_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    if other_id==user.id:raise api_error(422,"BLOCK_SELF","You cannot block yourself.")
    if not await db.get(User,other_id):raise api_error(404,"USER_NOT_FOUND","User not found.")
    item=await relationship(db,user.id,other_id)
    if item:item.requester_id=user.id;item.addressee_id=other_id;item.status=FriendshipStatus.BLOCKED
    else:item=Friendship(requester_id=user.id,addressee_id=other_id,status=FriendshipStatus.BLOCKED);db.add(item)
    await db.commit();return friendship_out(item)
@router.delete("/api/blocks/{other_id}",status_code=204)
async def unblock_user(other_id:uuid.UUID,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    item=await db.scalar(select(Friendship).where(Friendship.requester_id==user.id,Friendship.addressee_id==other_id,Friendship.status==FriendshipStatus.BLOCKED))
    if not item:raise api_error(404,"BLOCK_NOT_FOUND","Blocked user not found.")
    await db.delete(item);await db.commit()
@router.get("/api/profile")
async def profile(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):return await user_out(db,user,user.id)
@router.patch("/api/profile")
async def update_profile(body:ProfileIn,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    if body.display_name is not None:user.display_name=body.display_name.strip()
    if body.about is not None:user.about=body.about.strip()
    if body.avatar_key is not None:
        if not body.avatar_key.startswith(f"users/{user.id}/avatar/"):raise api_error(422,"AVATAR_INVALID","Avatar upload is invalid.")
        if not body.avatar_mime or not body.avatar_size:raise api_error(422,"AVATAR_INVALID","Avatar metadata is required.")
        from app.services.media import r2
        r2.validate_metadata("avatar",body.avatar_mime,body.avatar_size);await asyncio.to_thread(r2.verify_object,body.avatar_key,body.avatar_mime,body.avatar_size)
        if user.avatar_key and user.avatar_key!=body.avatar_key:
            await asyncio.to_thread(r2.delete,user.avatar_key)
        user.avatar_key=body.avatar_key
    await db.commit();return await user_out(db,user,user.id)
@router.get("/api/preferences")
async def get_preferences(user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    values=await preferences_out(db,user.id);blocked=(await db.scalars(select(Friendship.addressee_id).where(Friendship.requester_id==user.id,Friendship.status==FriendshipStatus.BLOCKED))).all();people=(await db.scalars(select(User).where(User.id.in_(blocked)))).all() if blocked else [];values["blocked"]=[str(x) for x in blocked];values["blockedUsers"]=[await user_out(db,x,user.id) for x in people];await db.commit();return values
@router.patch("/api/preferences")
async def update_preferences(body:PreferencesIn,user:User=Depends(current_user),db:AsyncSession=Depends(get_db)):
    pref=await db.get(UserPreference,user.id) or UserPreference(user_id=user.id);db.add(pref)
    for field,value in body.model_dump(exclude_none=True).items():setattr(pref,field,value)
    await db.commit();return await preferences_out(db,user.id)
