import json
import uuid
from datetime import datetime,timedelta,timezone
from app.core.exceptions import Conflict,NotFound


class TripDraftRepository:
    def __init__(self,store):
        self.store=store
        with store.connection() as db:
            db.execute('CREATE TABLE IF NOT EXISTS trip_previews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,expires_at TEXT NOT NULL)')
    def get(self,draft_id,user_id):
        with self.store.connection() as db:
            row=db.execute('SELECT data FROM trip_previews WHERE id=? AND user_id=? AND expires_at>?',
                           (draft_id,user_id,datetime.now(timezone.utc).isoformat())).fetchone()
        if not row:raise NotFound('Không tìm thấy bản xem trước còn hiệu lực của người dùng')
        return json.loads(row[0])
    def put(self,request,result,draft_id=None,expected_version=None):
        existing=self.get(draft_id,request.user_id) if draft_id else None
        if existing and existing['version']!=expected_version:raise Conflict('Bản xem trước đã đổi; tải lại phiên bản mới')
        if result['unscheduled_required_place_ids']:raise ValueError('Không thể xếp các địa điểm bắt buộc: '+', '.join(result['unscheduled_required_place_ids']))
        if not any(day['activities'] for day in result['days']):raise ValueError('Không có lịch trình khả thi; bản nháp cũ không bị thay đổi')
        uid=draft_id or str(uuid.uuid4());version=existing['version']+1 if existing else 1
        data={'draft_id':uid,'version':version,'request':request.model_dump(mode='json'),
              'result':{**result,'trip_id':uid,'draft_id':uid,'version':version,'user_id':request.user_id,'preview_only':True,'saved':False}}
        now=datetime.now(timezone.utc);expiry=(now+timedelta(hours=24)).isoformat()
        with self.store.connection() as db:
            db.execute('DELETE FROM trip_previews WHERE expires_at<?',(now.isoformat(),))
            if existing:
                changed=db.execute('UPDATE trip_previews SET version=?,data=?,expires_at=? WHERE id=? AND user_id=? AND version=?',
                                   (version,json.dumps(data,ensure_ascii=False),expiry,uid,request.user_id,expected_version)).rowcount
                if not changed:raise Conflict('Concurrent preview update')
            else:db.execute('INSERT INTO trip_previews VALUES(?,?,?,?,?)',(uid,request.user_id,version,json.dumps(data,ensure_ascii=False),expiry))
        return data

    def delete(self,draft_id,user_id):
        self.get(draft_id,user_id)
        with self.store.connection() as db:db.execute('DELETE FROM trip_previews WHERE id=? AND user_id=?',(draft_id,user_id))
