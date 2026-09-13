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

def create_access_token(user_id: str, session_id: str) -> str:
    settings = get_settings(); now = datetime.now(UTC)
    return jwt.encode({"sub": user_id, "sid": session_id, "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}, settings.jwt_access_secret, algorithm="HS256")

def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, get_settings().jwt_access_secret, algorithms=["HS256"])
    if not payload.get("sub") or not payload.get("sid"):
        raise jwt.InvalidTokenError("Access token is missing its session identifier")
    return payload

import hmac

def create_password_fingerprint(password_hash: str) -> str:
    secret = get_settings().jwt_access_secret.encode()
    return hmac.new(secret, password_hash.encode(), hashlib.sha256).hexdigest()

def create_reset_token(user_id: str, password_hash: str) -> str:
    settings = get_settings(); now = datetime.now(UTC)
    fingerprint = create_password_fingerprint(password_hash)
    payload = {
        "sub": user_id,
        "purpose": "password_reset",
        "psw": fingerprint,
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "jti": secrets.token_urlsafe(16)
    }
    return jwt.encode(payload, settings.jwt_access_secret, algorithm="HS256")

def decode_reset_token(token: str) -> dict:
    payload = jwt.decode(token, get_settings().jwt_access_secret, algorithms=["HS256"])
    if payload.get("purpose") != "password_reset":
        raise jwt.InvalidTokenError("Invalid token purpose")
    return payload

def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    secret = get_settings().jwt_refresh_secret
    return hashlib.sha256(f"{secret}:{token}".encode()).hexdigest()
