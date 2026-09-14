# SYORA backend

Python 3.12 FastAPI service for PostgreSQL, Socket.IO, and private Cloudflare R2 media.

Copy `.env.example` to `.env`, provide PostgreSQL and R2 credentials, run `alembic upgrade head`, then start with `uvicorn app.main:app --reload` from this directory. Render uses `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Keep the R2 bucket private. Its CORS policy must allow the exact `CLIENT_ORIGIN` to send `PUT` requests with `Content-Type`; downloads are issued as short-lived signed URLs by the API. The frontend uses `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` from `frontend/.env.example`.

After applying migrations, configure `SYORA_ADMIN_EMAIL` and `SYORA_ADMIN_BOOTSTRAP_PASSWORD` in the backend environment, then run `python -m app.scripts.bootstrap_admin` once. The command is idempotent: it promotes an existing matching account without changing its password or creates a missing account through the existing Argon2 hashing path.

Admin Web Push also requires one VAPID key pair. Generate it once with the `vapid` CLI installed by `pywebpush`, then store the public key in `VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`, and an administrator contact such as `mailto:admin@example.com` in `VAPID_SUBJECT`. Keep the private key only in the backend environment. The Settings page exposes device subscription controls only to a server-authorized admin.
