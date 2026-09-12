import time
from collections import defaultdict, deque
from fastapi import Request
from app.api.deps import api_error
_events:dict[str,deque[float]]=defaultdict(deque)
def rate_limit(bucket:str,limit:int,seconds:int):
    async def check(request:Request):
        key=f"{bucket}:{request.client.host if request.client else 'unknown'}"; now=time.monotonic(); q=_events[key]
        while q and q[0]<=now-seconds:q.popleft()
        if len(q)>=limit: raise api_error(429,"RATE_LIMITED","Too many requests. Please try again shortly.")
        q.append(now)
    return check
