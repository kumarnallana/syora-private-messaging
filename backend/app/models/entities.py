import enum
import uuid
from datetime import UTC, datetime
from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

def now() -> datetime: return datetime.now(UTC)
class FriendshipStatus(str, enum.Enum): PENDING="PENDING"; ACCEPTED="ACCEPTED"; DECLINED="DECLINED"; BLOCKED="BLOCKED"
class ConversationType(str, enum.Enum): DIRECT="DIRECT"
class MessageType(str, enum.Enum): TEXT="TEXT"; IMAGE="IMAGE"; VIDEO="VIDEO"; DOCUMENT="DOCUMENT"; SYSTEM="SYSTEM"
class StatusType(str, enum.Enum): TEXT="TEXT"; IMAGE="IMAGE"; VIDEO="VIDEO"

class User(Base):
    __tablename__="users"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    display_name:Mapped[str]=mapped_column(String(80))
    email:Mapped[str]=mapped_column(String(320),unique=True)
    password_hash:Mapped[str]=mapped_column(Text)
    avatar_key:Mapped[str|None]=mapped_column(Text)
    about:Mapped[str]=mapped_column(String(160),default="")
    last_seen_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,onupdate=now)

class RefreshSession(Base):
    __tablename__="refresh_sessions"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),index=True)
    token_hash:Mapped[str]=mapped_column(String(64),unique=True)
    expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    revoked_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    user_agent:Mapped[str|None]=mapped_column(String(300))

class Friendship(Base):
    __tablename__="friendships"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    requester_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),index=True)
    addressee_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),index=True)
    status:Mapped[FriendshipStatus]=mapped_column(Enum(FriendshipStatus,name="friendship_status"),index=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,onupdate=now)
    __table_args__=(CheckConstraint("requester_id <> addressee_id",name="ck_friendship_not_self"),Index("uq_friendship_pair",func.least(requester_id,addressee_id),func.greatest(requester_id,addressee_id),unique=True),)

class Conversation(Base):
    __tablename__="conversations"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    type:Mapped[ConversationType]=mapped_column(Enum(ConversationType,name="conversation_type"),default=ConversationType.DIRECT)
    direct_key:Mapped[str|None]=mapped_column(String(73),unique=True)
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,onupdate=now)
    last_message_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True),index=True)

class ConversationParticipant(Base):
    __tablename__="conversation_participants"
    conversation_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("conversations.id",ondelete="CASCADE"),primary_key=True)
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),primary_key=True,index=True)
    joined_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    last_read_message_id:Mapped[uuid.UUID|None]=mapped_column(ForeignKey("messages.id",ondelete="SET NULL"))
    pinned:Mapped[bool]=mapped_column(Boolean,default=False)
    muted:Mapped[bool]=mapped_column(Boolean,default=False)

class Message(Base):
    __tablename__="messages"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    conversation_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("conversations.id",ondelete="CASCADE"))
    sender_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),index=True)
    type:Mapped[MessageType]=mapped_column(Enum(MessageType,name="message_type"),default=MessageType.TEXT)
    text:Mapped[str]=mapped_column(Text,default="")
    reply_to_message_id:Mapped[uuid.UUID|None]=mapped_column(ForeignKey("messages.id",ondelete="SET NULL"))
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now,onupdate=now)
    deleted_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    __table_args__=(Index("ix_messages_conversation_created",conversation_id,created_at),)

class MessageReceipt(Base):
    __tablename__="message_receipts"
    message_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("messages.id",ondelete="CASCADE"),primary_key=True)
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),primary_key=True)
    delivered_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))
    read_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True))

class MessageVisibility(Base):
    __tablename__="message_visibility"
    message_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("messages.id",ondelete="CASCADE"),primary_key=True)
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),primary_key=True)
    hidden_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

class Attachment(Base):
    __tablename__="attachments"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    message_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("messages.id",ondelete="CASCADE"),unique=True)
    object_key:Mapped[str]=mapped_column(Text,unique=True)
    file_name:Mapped[str]=mapped_column(String(255))
    mime_type:Mapped[str]=mapped_column(String(150))
    file_size:Mapped[int]=mapped_column(BigInteger)
    width:Mapped[int|None]
    height:Mapped[int|None]
    duration:Mapped[int|None]
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

class StatusPost(Base):
    __tablename__="status_posts"
    id:Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"))
    type:Mapped[StatusType]=mapped_column(Enum(StatusType,name="status_type"))
    text:Mapped[str]=mapped_column(String(500),default="")
    object_key:Mapped[str|None]=mapped_column(Text)
    file_name:Mapped[str|None]=mapped_column(String(255))
    mime_type:Mapped[str|None]=mapped_column(String(150))
    file_size:Mapped[int|None]=mapped_column(BigInteger)
    color:Mapped[str]=mapped_column(String(20),default="#4c3f66")
    created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)
    expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
    __table_args__=(Index("ix_status_user_expiry",user_id,expires_at),)

class StatusView(Base):
    __tablename__="status_views"
    status_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("status_posts.id",ondelete="CASCADE"),primary_key=True)
    viewer_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),primary_key=True)
    viewed_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=now)

class UserPreference(Base):
    __tablename__="user_preferences"
    user_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),primary_key=True)
    read_receipts:Mapped[bool]=mapped_column(Boolean,default=True)
    last_seen_visibility:Mapped[str]=mapped_column(String(30),default="Friends")
    profile_photo_visibility:Mapped[str]=mapped_column(String(30),default="Friends")
    status_visibility:Mapped[str]=mapped_column(String(30),default="Friends")
