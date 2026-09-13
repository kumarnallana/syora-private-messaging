import asyncio

from sqlalchemy import func, select

from app.config.security import hash_password
from app.config.settings import get_settings
from app.db.session import SessionLocal
from app.models import User, UserPreference


async def bootstrap_admin() -> None:
    settings = get_settings()
    email = settings.admin_email.strip().lower()
    if not email:
        raise SystemExit("SYORA_ADMIN_EMAIL is required.")
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(func.lower(User.email) == email))
        if user:
            if user.role != "admin":
                user.role = "admin"
                await db.commit()
                print("Existing account promoted to admin.")
            else:
                print("Admin account is already configured.")
            return
        if not settings.admin_bootstrap_password:
            raise SystemExit("SYORA_ADMIN_BOOTSTRAP_PASSWORD is required to create a missing admin account.")
        if len(settings.admin_bootstrap_password) < 8:
            raise SystemExit("SYORA_ADMIN_BOOTSTRAP_PASSWORD must contain at least 8 characters.")
        username = settings.admin_username.strip().lstrip("@").lower()
        if len(username) < 3 or len(username) > 32 or not all(character.islower() or character.isdigit() or character == "_" for character in username):
            raise SystemExit("SYORA_ADMIN_USERNAME must use 3–32 lowercase letters, numbers, or underscores.")
        if await db.scalar(select(User.id).where(User.username == username)):
            raise SystemExit("SYORA_ADMIN_USERNAME is already assigned to another account.")
        user = User(
            display_name=settings.admin_display_name.strip() or "SYORA Admin",
            username=username,
            email=email,
            password_hash=hash_password(settings.admin_bootstrap_password),
            role="admin",
        )
        db.add(user)
        await db.flush()
        db.add(UserPreference(user_id=user.id))
        await db.commit()
        print("Admin account created.")


if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
