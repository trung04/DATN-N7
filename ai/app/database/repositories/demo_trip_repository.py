"""Explicitly saved AI demo trips; separate from production backend persistence."""
import json
import uuid
from datetime import datetime,timezone
from app.core.exceptions import Conflict,NotFound
from .trip_draft_repository import TripDraftRepository


class DemoTripRepository:
    def __init__(self,store):
        self.store=store
        with store.connection() as db:
            db.execute('CREATE TABLE IF NOT EXISTS demo_saved_trips(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,version INTEGER NOT NULL,draft_id TEXT NOT NULL,draft_version INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,draft_id))')
            db.execute('CREATE INDEX IF NOT EXISTS demo_trips_owner ON demo_saved_trips(user_id,updated_at)')
    def get(self,trip_id,user_id):
        with self.store.connection() as db:row=db.execute('SELECT data FROM demo_saved_trips WHERE id=? AND user_id=?',(trip_id,user_id)).fetchone()
        if not row:raise NotFound('Không tìm thấy lịch AI demo của người dùng')
        return json.loads(row[0])
    def list(self,user_id):
        with self.store.connection() as db:
            return [dict(r) for r in db.execute('SELECT id,name,version,updated_at FROM demo_saved_trips WHERE user_id=? ORDER BY updated_at DESC,id LIMIT 100',(user_id,))]
    def save(self,user_id,draft_id,expected_draft_version,name,trip_id=None,expected_version=None):
        draft=TripDraftRepository(self.store).get(draft_id,user_id)
        if draft['version']!=expected_draft_version:raise Conflict('Bản xem trước đã đổi; tải lại trước khi lưu')
        if not name.strip():raise ValueError('Tên lịch trình không được trống')
        with self.store.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            current=db.execute('SELECT version FROM trip_previews WHERE id=? AND user_id=? AND expires_at>?',(draft_id,user_id,datetime.now(timezone.utc).isoformat())).fetchone()
            if not current or current[0]!=expected_draft_version:raise Conflict('Bản xem trước đã đổi hoặc hết hạn')
            old=db.execute('SELECT * FROM demo_saved_trips WHERE user_id=? AND '+('id=?' if trip_id else 'draft_id=?'),(user_id,trip_id or draft_id)).fetchone()
            collision=db.execute('SELECT id FROM demo_saved_trips WHERE user_id=? AND draft_id=?',(user_id,draft_id)).fetchone()
            if trip_id and collision and collision[0]!=trip_id:raise Conflict('Bản xem trước đã thuộc một lịch demo khác')
            if trip_id and (not old or old['id']!=trip_id):raise NotFound('Không tìm thấy lịch demo để cập nhật')
            if old and old['draft_id']==draft_id and old['draft_version']==expected_draft_version and old['name']==name.strip():return json.loads(old['data'])
            if old and old['version']!=expected_version:raise Conflict('Lịch đã lưu thay đổi; tải lại trước khi cập nhật')
            uid=old['id'] if old else str(uuid.uuid4());version=old['version']+1 if old else 1;now=datetime.now(timezone.utc).isoformat()
            data={'id':uid,'name':name.strip(),'version':version,'request':draft['request'],'updated_at':now,
                  'result':{**draft['result'],'trip_id':uid,'version':version,'saved':True,'preview_only':False,'storage':'ai_demo'}}
            if old:db.execute('UPDATE demo_saved_trips SET name=?,version=?,draft_id=?,draft_version=?,data=?,updated_at=? WHERE id=? AND user_id=?',
                (data['name'],version,draft_id,expected_draft_version,json.dumps(data,ensure_ascii=False),now,uid,user_id))
            else:db.execute('INSERT INTO demo_saved_trips VALUES(?,?,?,?,?,?,?,?)',(uid,user_id,data['name'],version,draft_id,expected_draft_version,json.dumps(data,ensure_ascii=False),now))
        return data
    def delete(self,trip_id,user_id,expected_version):
        with self.store.connection() as db:
            row=db.execute('SELECT version FROM demo_saved_trips WHERE id=? AND user_id=?',(trip_id,user_id)).fetchone()
            if not row:raise NotFound('Không tìm thấy lịch demo')
            if row[0]!=expected_version:raise Conflict('Lịch demo đã đổi; tải lại trước khi xóa')
            db.execute('DELETE FROM demo_saved_trips WHERE id=? AND user_id=? AND version=?',(trip_id,user_id,expected_version))
