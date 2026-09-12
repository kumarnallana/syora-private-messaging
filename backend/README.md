# SYORA backend

Python 3.12 FastAPI service for PostgreSQL, Socket.IO, and private Cloudflare R2 media.

Copy `.env.example` to `.env`, provide PostgreSQL and R2 credentials, run `alembic upgrade head`, then start with `uvicorn app.main:app --reload` from this directory. Render uses `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Keep the R2 bucket private. Its CORS policy must allow the exact `CLIENT_ORIGIN` to send `PUT` requests with `Content-Type`; downloads are issued as short-lived signed URLs by the API. The frontend uses `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` from the repository `.env.example`.