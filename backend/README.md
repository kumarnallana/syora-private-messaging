# SYORA backend

Python 3.12 FastAPI service for PostgreSQL, Socket.IO, and private Cloudflare R2 media.

Run migrations with `alembic upgrade head`, then start locally with `uvicorn app.main:app --reload` from this directory. Render start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
