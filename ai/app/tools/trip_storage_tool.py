"""PostgreSQL persistence through the backend's authenticated service boundary."""
import json
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from urllib.parse import urlsplit
from fastapi import HTTPException
from app.core.config import env


def saved_trip_call(action,user_id,parameters):
    base=env('TRIP_BACKEND_URL','').rstrip('/')
    parsed=urlsplit(base)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.password:
        raise HTTPException(503,'TRIP_BACKEND_URL chưa được cấu hình')
    body={**parameters,'userId':user_id}
    request=Request(base+'/api/v1/internal/trip-planner/'+action,data=json.dumps(body).encode(),
                    headers={'Content-Type':'application/json','X-AI-Key':env('RECOMMENDATION_API_KEY','')})
    try:
        with urlopen(request,timeout=30) as response:raw=response.read(4_000_001)
    except HTTPError as error:
        raise HTTPException(error.code if error.code in (400,404,409) else 503,'Không thể đọc/lưu lịch trình; kiểm tra quyền sở hữu và phiên bản.') from None
    except (URLError,TimeoutError):raise HTTPException(503,'Backend lưu lịch trình chưa sẵn sàng') from None
    if len(raw)>4_000_000:raise ValueError('Saved trip response too large')
    return json.loads(raw)
