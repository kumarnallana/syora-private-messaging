import hashlib
import secrets
from datetime import UTC, datetime, timedelta
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from app.config.settings import get_settings

_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    return _hasher.hash(password)

def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def create_access_token(user_id: str) -> str:
    settings = get_settings(); now = datetime.now(UTC)
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}, settings.jwt_access_secret, algorithm="HS256")

def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, get_settings().jwt_access_secret, algorithms=["HS256"])
    return str(payload["sub"])

def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    secret = get_settings().jwt_refresh_secret
    return hashlib.sha256(f"{secret}:{token}".encode()).hexdigest()
