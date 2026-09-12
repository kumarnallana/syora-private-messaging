import socketio
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import auth, chat, media, status, users
from app.config.settings import get_settings
from app.realtime.socket import sio
settings=get_settings();api=FastAPI(title="SYORA API",version="0.1.0",docs_url="/api/docs" if not settings.production else None)
api.add_middleware(CORSMiddleware,allow_origins=[settings.client_origin],allow_credentials=True,allow_methods=["GET","POST","PATCH","DELETE","OPTIONS"],allow_headers=["Authorization","Content-Type"])
@api.exception_handler(HTTPException)
async def http_error(_:Request,exc:HTTPException):
    detail=exc.detail if isinstance(exc.detail,dict) else {"code":"REQUEST_ERROR","message":str(exc.detail)}
    return JSONResponse(status_code=exc.status_code,content={"error":detail})
@api.exception_handler(RequestValidationError)
async def validation_error(_:Request,exc:RequestValidationError):
    first=exc.errors()[0] if exc.errors() else {};return JSONResponse(status_code=422,content={"error":{"code":"VALIDATION_ERROR","message":str(first.get("msg","Invalid request."))}})
@api.exception_handler(Exception)
async def server_error(_:Request,exc:Exception):
    if not settings.production:print(f"Unhandled error: {exc!r}")
    return JSONResponse(status_code=500,content={"error":{"code":"INTERNAL_ERROR","message":"The request could not be completed."}})
@api.get("/api/health")
async def health():return {"status":"ok"}
for router in (auth.router,users.router,chat.router,media.router,status.router):api.include_router(router)
app=socketio.ASGIApp(sio,other_asgi_app=api,socketio_path="socket.io")
