"""Backend-owned PostgreSQL coordinates/cache and ORS provider. No geometric fallback."""
import json
import math
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from fastapi import HTTPException
from app.core.config import env


class OrsMatrix:
    def build(self, locations, transport):
        mode=env('TRIP_ORS_MODE','auto')
        if mode not in ('auto','direct','backend'):raise ValueError('TRIP_ORS_MODE must be auto, direct or backend')
        if mode=='direct' or (mode=='auto' and env('ORS_API_KEY')):
            from .standalone_ors import StandaloneOrs
            return StandaloneOrs().build(locations,transport)
        base=env('TRIP_BACKEND_URL','').rstrip('/')
        parsed=urlsplit(base)
        if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.password:
            raise HTTPException(503,{'code':'ROUTING_BACKEND_NOT_CONFIGURED','message':'Cần TRIP_BACKEND_URL để đọc tọa độ/cache PostgreSQL và gọi ORS.'})
        points=[{'placeId':p['place_id']} if p.get('place_id') else {'latitude':p['latitude'],'longitude':p['longitude']} for p in locations]
        profile={'driving':'driving-car','walking':'foot-walking','cycling':'cycling-regular'}[transport]
        request=Request(base+'/api/v1/internal/routing/matrix',data=json.dumps({'locations':points,'profile':profile}).encode(),
                        headers={'Content-Type':'application/json','X-AI-Key':env('RECOMMENDATION_API_KEY','')})
        try:
            with urlopen(request,timeout=120) as response:raw=response.read(4_000_001)
        except HTTPError as exc:
            # Backend RFC9457 contains sanitized routing failure codes, not provider bodies/keys.
            try:detail=json.loads(exc.read(4000)).get('detail','Routing service unavailable')
            except ValueError:detail='Routing service unavailable'
            raise HTTPException(503,{'code':'ORS_MATRIX_UNAVAILABLE','message':str(detail)[:500]}) from None
        except (URLError,TimeoutError):raise HTTPException(503,{'code':'ORS_MATRIX_TIMEOUT','message':'Không lấy được ma trận đường bộ; không tự dùng ước tính.'}) from None
        if len(raw)>4_000_000:raise ValueError('Routing response too large')
        data=json.loads(raw);n=len(locations)
        if data.get('place_ids')!=[p.get('place_id') for p in locations]:raise ValueError('Routing changed place ID order')
        if len(data.get('coordinates',[]))!=n:raise ValueError('Missing authoritative routing coordinates')
        for actual,original in zip(data.get('coordinates',[]),locations):
            if abs(actual[0]-original['longitude'])>1e-6 or abs(actual[1]-original['latitude'])>1e-6:
                raise HTTPException(409,{'code':'PLACE_COORDINATES_CHANGED','message':'Tọa độ PostgreSQL khác catalog AI; cần đồng bộ lại trước khi lên lịch.'})
        for name in ('durations','distances'):
            m=data.get(name)
            if not isinstance(m,list) or len(m)!=n or any(not isinstance(row,list) or len(row)!=n for row in m):raise ValueError('Routing matrix size mismatch')
            if any(v is not None and (isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0) for row in m for v in row):raise ValueError('Invalid routing value')
        return {'source':'ors','estimated':False,'transport':transport,
                'minutes':[[v/60 if v is not None else None for v in row] for row in data['durations']],
                'kilometers':[[v/1000 if v is not None else None for v in row] for row in data['distances']],
                'place_ids':data['place_ids'],'cached_pairs':data.get('cached_pairs',0),
                'warnings':['ORS cung cấp đường bộ, không phải giao thông thời gian thực.']}
