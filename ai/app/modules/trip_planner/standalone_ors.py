"""AI-demo road matrices with bounded ORS calls and an AI-owned directed cache.

The standalone demo uses its existing catalog coordinates. Production callers can
keep TRIP_ORS_MODE=backend for PostgreSQL validation/cache at the backend boundary.
"""
import hashlib
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path
import sqlite3
import threading
import time
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
from urllib.parse import urlsplit
from fastapi import HTTPException
from app.core.config import env

_gate=threading.Lock()
_next_call=0.

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,message,headers,newurl):return None

def urlopen(request,timeout):
    return build_opener(NoRedirect()).open(request,timeout=timeout)


class StandaloneOrs:
    def __init__(self):
        base=env('ORS_BASE_URL','https://api.heigit.org').rstrip('/')
        parsed=urlsplit(base)
        if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/'):
            raise ValueError('ORS_BASE_URL must be an HTTPS origin without credentials')
        self.base=base+('/openrouteservice' if parsed.hostname=='api.heigit.org' else '')
        self.path=env('TRIP_ORS_CACHE_PATH',str(Path(env('RECOMMENDATION_DB_PATH','data/recommendation.sqlite3')).parent/'route_matrix_cache.sqlite3'))
        Path(self.path).parent.mkdir(parents=True,exist_ok=True)
        with self.connection() as db:
            db.execute('CREATE TABLE IF NOT EXISTS route_pairs(key TEXT PRIMARY KEY,seconds REAL,meters REAL,expires_at REAL NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS route_pair_expiry ON route_pairs(expires_at)')

    @contextmanager
    def connection(self):
        db=sqlite3.connect(self.path,timeout=5)
        try:
            with db:yield db
        finally:db.close()

    def table(self,coordinates,sources,destinations,profile,deadline):
        global _next_call
        key=env('ORS_API_KEY')
        if not key:raise HTTPException(503,'ORS_API_KEY chưa được cấu hình trong AI service')
        with _gate:
            for attempt in range(3):
                pause=max(0,_next_call-time.monotonic())
                if time.monotonic()+pause>=deadline:raise HTTPException(503,'ORS vượt thời gian xử lý; lịch hiện tại được giữ nguyên')
                if pause:time.sleep(pause)
                _next_call=time.monotonic()+max(0,float(env('ORS_MIN_INTERVAL_MS','2100')))/1000
                request=Request(self.base+'/v2/matrix/'+profile,data=json.dumps({'locations':coordinates,'sources':sources,'destinations':destinations,'metrics':['duration','distance'],'units':'m'}).encode(),
                    headers={'Authorization':key,'Content-Type':'application/json'})
                try:
                    remaining=deadline-time.monotonic()
                    if remaining<=0:raise TimeoutError()
                    with urlopen(request,timeout=min(15,remaining)) as response:raw=response.read(4_000_001)
                    if len(raw)>4_000_000:raise ValueError('ORS response too large')
                    data=json.loads(raw)
                    for name in ('durations','distances'):
                        matrix=data.get(name)
                        if not isinstance(matrix,list) or len(matrix)!=len(sources) or any(not isinstance(row,list) or len(row)!=len(destinations) for row in matrix):raise ValueError('Invalid ORS matrix dimensions')
                        if any(v is not None and (isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0) for row in matrix for v in row):raise ValueError('Invalid ORS matrix values')
                    return data
                except HTTPError as error:
                    status=error.code;error.close()
                    if status not in (429,500,502,503,504) or attempt==2:raise HTTPException(503,f'ORS từ chối yêu cầu (HTTP {status}); kiểm tra key, quota hoặc vùng dữ liệu') from None
                except (URLError,TimeoutError,OSError):
                    if attempt==2:raise HTTPException(503,'Không kết nối được ORS; không tự thay bằng khoảng cách ước tính') from None
                except (ValueError,KeyError,TypeError):
                    raise HTTPException(502,'ORS trả ma trận không hợp lệ; lịch hiện tại được giữ nguyên') from None
                _next_call=max(_next_call,time.monotonic()+min(5,2**attempt))

    def build(self,locations,transport):
        if not 1<=len(locations)<=82:raise ValueError('ORS supports 1–82 demo locations')
        profile={'driving':'driving-car','walking':'foot-walking','cycling':'cycling-regular'}[transport]
        if profile not in env('ORS_PROFILES','driving-car').split(','):raise HTTPException(422,'Phương tiện chưa được bật trong ORS_PROFILES')
        coordinates=[]
        for point in locations:
            lat,lon=point['latitude'],point['longitude']
            if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in (lat,lon)) or abs(lat)>90 or abs(lon)>180:raise ValueError('Invalid location coordinates')
            coordinates.append([lon,lat])
        n=len(locations);now=time.time();ttl=min(604800,max(60,int(env('ORS_CACHE_TTL_SECONDS','21600'))));deadline=time.monotonic()+120
        keys=[[hashlib.sha256(json.dumps([self.base,profile,a,b],separators=(',',':')).encode()).hexdigest() if i!=j else '' for j,b in enumerate(coordinates)] for i,a in enumerate(coordinates)]
        wanted=set(k for row in keys for k in row if k);hits={}
        with self.connection() as db:
            ordered=list(wanted)
            for start in range(0,len(ordered),500):
                batch=ordered[start:start+500]
                for key,seconds,meters in db.execute('SELECT key,seconds,meters FROM route_pairs WHERE key IN ('+','.join('?' for _ in batch)+') AND expires_at>?',(*batch,now)):
                    hits[key]=(seconds,meters)
        cached=len(hits)
        for row in range(0,n,25):
            for col in range(0,n,25):
                sources=list(range(row,min(row+25,n)));destinations=list(range(col,min(col+25,n)))
                if not any(i!=j and keys[i][j] not in hits for i in sources for j in destinations):continue
                union=list(dict.fromkeys(sources+destinations))
                data=self.table([coordinates[i] for i in union],[union.index(i) for i in sources],[union.index(i) for i in destinations],profile,deadline)
                values=[]
                for x,i in enumerate(sources):
                    for y,j in enumerate(destinations):
                        if i==j or keys[i][j] in hits:continue
                        seconds,meters=data['durations'][x][y],data['distances'][x][y]
                        if seconds is None or meters is None:seconds=meters=None
                        hits[keys[i][j]]=(seconds,meters);values.append((keys[i][j],seconds,meters,time.time()+ttl))
                with self.connection() as db:
                    db.executemany('INSERT OR REPLACE INTO route_pairs VALUES(?,?,?,?)',values)
                    db.execute('DELETE FROM route_pairs WHERE expires_at<?',(time.time(),))
        durations=[[0 if i==j else hits[keys[i][j]][0] for j in range(n)] for i in range(n)]
        distances=[[0 if i==j else hits[keys[i][j]][1] for j in range(n)] for i in range(n)]
        return {'source':'ors','estimated':False,'transport':transport,'minutes':[[v/60 if v is not None else None for v in row] for row in durations],
            'kilometers':[[v/1000 if v is not None else None for v in row] for row in distances], 'place_ids':[p.get('place_id') for p in locations],
            'cached_pairs':cached,'warnings':['ORS cung cấp đường bộ, không phải giao thông thời gian thực.','AI demo dùng tọa độ catalog AI và cache cục bộ; không xác minh tọa độ qua backend.']}
