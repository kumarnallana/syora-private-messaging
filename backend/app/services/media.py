import re, uuid
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.config.settings import get_settings
from app.api.deps import api_error
ALLOWED={"image":{"image/jpeg","image/png","image/webp","image/gif"},"video":{"video/mp4","video/webm","video/quicktime"},"document":{"application/pdf","text/plain","text/csv","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"},"avatar":{"image/jpeg","image/png","image/webp"},"status":{"image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"}}
LIMITS={"image":10,"video":50,"document":20,"avatar":5,"status":50}
class R2:
    def __init__(self):
        s=get_settings(); self.bucket=s.r2_bucket; self.configured=all([s.r2_account_id,s.r2_access_key_id,s.r2_secret_access_key,s.r2_bucket])
        self.client=boto3.client("s3",endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",aws_access_key_id=s.r2_access_key_id,aws_secret_access_key=s.r2_secret_access_key,config=Config(signature_version="s3v4"),region_name="auto") if self.configured else None
    def validate_metadata(self,kind:str,mime:str,size:int):
        if mime not in ALLOWED[kind]: raise api_error(422,"MEDIA_TYPE_INVALID","This file type is not supported.")
        limit_kind="image" if kind=="status" and mime.startswith("image/") else "video" if kind=="status" else kind
        if size>LIMITS[limit_kind]*1024*1024: raise api_error(413,"MEDIA_TOO_LARGE",f"The {limit_kind} exceeds the {LIMITS[limit_kind]} MB limit.")
    def validate(self,kind:str,mime:str,size:int):
        self.validate_metadata(kind,mime,size)
        if not self.configured: raise api_error(503,"MEDIA_NOT_CONFIGURED","Media storage is not configured.")
    def key(self,user_id:uuid.UUID,kind:str,name:str)->str:
        safe=re.sub(r"[^A-Za-z0-9._-]","_",name)[-100:]
        return f"users/{user_id}/{kind}/{uuid.uuid4()}-{safe}"
    def upload_url(self,key:str,mime:str)->str:
        if not self.client:raise api_error(503,"MEDIA_NOT_CONFIGURED","Media storage is not configured.")
        return self.client.generate_presigned_url("put_object",Params={"Bucket":self.bucket,"Key":key,"ContentType":mime},ExpiresIn=600)
    def access_url(self,key:str)->str:
        if not self.client:raise api_error(503,"MEDIA_NOT_CONFIGURED","Media storage is not configured.")
        return self.client.generate_presigned_url("get_object",Params={"Bucket":self.bucket,"Key":key},ExpiresIn=600)
    def verify_object(self,key:str,mime:str,size:int)->None:
        if not self.client:raise api_error(503,"MEDIA_NOT_CONFIGURED","Media storage is not configured.")
        try:metadata=self.client.head_object(Bucket=self.bucket,Key=key)
        except ClientError:raise api_error(422,"MEDIA_UPLOAD_MISSING","The uploaded file could not be verified.")
        if metadata.get("ContentLength")!=size or metadata.get("ContentType")!=mime:raise api_error(422,"MEDIA_UPLOAD_MISMATCH","The uploaded file does not match its metadata.")
    def delete(self,key:str)->None:
        if self.client:self.client.delete_object(Bucket=self.bucket,Key=key)
r2=R2()
