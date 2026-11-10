import json
import uuid
from datetime import datetime, timezone
from app.core.exceptions import Conflict, NotFound


class TripRepository:
    def __init__(self, store):
        self.store = store
        with store.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS trips (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, version INTEGER NOT NULL,
                    request TEXT NOT NULL, result TEXT NOT NULL, updated_at TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS trip_user ON trips(user_id);
            """)

    def save(self, request, result):
        result = {**result, "trip_id":str(uuid.uuid4()), "version":1, "user_id":request.user_id}
        with self.store.connection() as db:
            db.execute("INSERT INTO trips VALUES (?,?,?,?,?,?)", (result["trip_id"],request.user_id,1,
                request.model_dump_json(),json.dumps(result,ensure_ascii=False),datetime.now(timezone.utc).isoformat()))
        return result

    def get(self, trip_id, user_id):
        with self.store.connection() as db:
            row = db.execute("SELECT * FROM trips WHERE id=? AND user_id=?",(trip_id,user_id)).fetchone()
        if not row:
            raise NotFound("Không tìm thấy lịch trình của người dùng")
        return dict(row)

    def update(self, trip_id, user_id, expected_version, request, result):
        result = {**result,"version":expected_version+1}
        with self.store.connection() as db:
            changed = db.execute("UPDATE trips SET version=?,request=?,result=?,updated_at=? WHERE id=? AND user_id=? AND version=?",
                (expected_version+1,request.model_dump_json(),json.dumps(result,ensure_ascii=False),datetime.now(timezone.utc).isoformat(),trip_id,user_id,expected_version)).rowcount
            if not changed:
                raise Conflict("Lịch trình đã đổi; tải phiên bản mới trước khi sửa")
        return result


