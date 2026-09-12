import re
import uuid
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

class RegisterIn(BaseModel):
    display_name:str=Field(min_length=1,max_length=80)
    username:str=Field(min_length=3,max_length=32)
    email:EmailStr
    password:str=Field(min_length=8,max_length=128)
    @field_validator("display_name")
    @classmethod
    def trim_name(cls,v:str)->str:
        v=v.strip()
        if not v: raise ValueError("Display name is required.")
        return v
    @field_validator("username")
    @classmethod
    def normalize_username(cls,v:str)->str:
        value=v.strip().removeprefix("@").lower()
        if not re.fullmatch(r"[a-z0-9_]{3,32}",value):
            raise ValueError("Use 3–32 lowercase letters, numbers, or underscores.")
        return value
class LoginIn(BaseModel): email:EmailStr; password:str=Field(min_length=1,max_length=128)
class ForgotPasswordIn(BaseModel): email:EmailStr
class ResetPasswordIn(BaseModel):
    token:str=Field(min_length=1)
    password:str=Field(min_length=8,max_length=128)

class ProfileIn(BaseModel):
    display_name:str|None=Field(default=None,min_length=1,max_length=80)
    username:str|None=Field(default=None,min_length=3,max_length=32)
    about:str|None=Field(default=None,max_length=160)
    avatar_key:str|None=Field(default=None,max_length=600)
    avatar_mime:str|None=Field(default=None,max_length=150)
    avatar_size:int|None=Field(default=None,gt=0)
    @field_validator("username")
    @classmethod
    def normalize_profile_username(cls,v:str|None)->str|None:
        if v is None:return None
        value=v.strip().removeprefix("@").lower()
        if not re.fullmatch(r"[a-z0-9_]{3,32}",value):
            raise ValueError("Use 3–32 lowercase letters, numbers, or underscores.")
        return value
class PreferencesIn(BaseModel):
    read_receipts:bool|None=None
    last_seen_visibility:Literal["Everyone","Friends","Nobody"]|None=None
    profile_photo_visibility:Literal["Everyone","Friends","Nobody"]|None=None
    status_visibility:Literal["Friends","Nobody"]|None=None
class FriendRequestIn(BaseModel): user_id:uuid.UUID
class FriendResponseIn(BaseModel): action:Literal["accept","decline"]
class DirectConversationIn(BaseModel): user_id:uuid.UUID
class ConversationPreferenceIn(BaseModel): pinned:bool|None=None; muted:bool|None=None
class AttachmentIn(BaseModel):
    object_key:str=Field(min_length=1,max_length=700)
    file_name:str=Field(min_length=1,max_length=255)
    mime_type:str=Field(min_length=1,max_length=150)
    file_size:int=Field(gt=0)
    width:int|None=Field(default=None,gt=0)
    height:int|None=Field(default=None,gt=0)
    duration:int|None=Field(default=None,ge=0)
class MessageIn(BaseModel):
    text:str=Field(default="",max_length=10000)
    reply_to:uuid.UUID|None=None
    attachment:AttachmentIn|None=None
    @field_validator("text")
    @classmethod
    def trim_text(cls,v:str)->str:return v.strip()
class DeleteMessageIn(BaseModel): mode:Literal["me","everyone"]
class UploadRequestIn(BaseModel):
    kind:Literal["image","video","document","avatar","status"]
    file_name:str=Field(min_length=1,max_length=255)
    mime_type:str=Field(min_length=1,max_length=150)
    file_size:int=Field(gt=0)
class StatusIn(BaseModel):
    text:str=Field(default="",max_length=500)
    color:str=Field(default="#4c3f66",pattern=r"^#[0-9A-Fa-f]{6}$")
    attachment:AttachmentIn|None=None
    @field_validator("text")
    @classmethod
    def trim_status(cls,v:str)->str:return v.strip()
