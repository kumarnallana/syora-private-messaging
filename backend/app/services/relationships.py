import uuid
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Friendship, FriendshipStatus

def pair_clause(a:uuid.UUID,b:uuid.UUID):
    return or_(and_(Friendship.requester_id==a,Friendship.addressee_id==b),and_(Friendship.requester_id==b,Friendship.addressee_id==a))
async def relationship(db:AsyncSession,a:uuid.UUID,b:uuid.UUID)->Friendship|None:
    return await db.scalar(select(Friendship).where(pair_clause(a,b)))
async def accepted(db:AsyncSession,a:uuid.UUID,b:uuid.UUID)->bool:
    rel=await relationship(db,a,b); return bool(rel and rel.status==FriendshipStatus.ACCEPTED)
async def blocked(db:AsyncSession,a:uuid.UUID,b:uuid.UUID)->bool:
    rel=await relationship(db,a,b); return bool(rel and rel.status==FriendshipStatus.BLOCKED)
