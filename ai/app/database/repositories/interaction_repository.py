import json
from app.core.exceptions import Conflict, NotFound

class InteractionRepository:
    def recent_exposures(self,user_id,now,days=14):
        from collections import Counter
        from datetime import datetime,timedelta
        counts=Counter()
        with self.connection() as db:
            rows=db.execute("SELECT e.data FROM exposures e JOIN impressions i ON e.request_id=i.id WHERE i.user_id=?",(user_id,))
            for row in rows:
                value=json.loads(row[0]);dt=datetime.fromisoformat(value['occurred_at'])
                if now-timedelta(days=days)<=dt<=now:counts.update(value['place_ids'])
        return counts
    def events(self, user_id=None):
        with self.connection() as db:
            if user_id is None:
                rows = db.execute("SELECT data FROM events ORDER BY occurred_at,id")
            else:
                rows = db.execute("SELECT data FROM events WHERE user_id=? ORDER BY occurred_at,id", (user_id,))
            return [json.loads(row[0]) for row in rows]

    def add_event(self, event):
        from datetime import timezone
        data = event.model_dump(mode="json")
        data["occurred_at"] = event.occurred_at.astimezone(timezone.utc).isoformat()
        serialized = json.dumps(data, sort_keys=True, ensure_ascii=False)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT data FROM events WHERE id=?", (event.event_id,)).fetchone()
            if old:
                if old[0] != serialized:
                    raise Conflict("event_id đã dùng với nội dung khác; retry cần giữ nguyên occurred_at")
                return False
            if not db.execute("SELECT 1 FROM places WHERE id=?", (event.place_id,)).fetchone():
                raise NotFound("Không tìm thấy địa điểm")
            if event.request_id:
                row = db.execute("SELECT user_id,data,occurred_at FROM impressions WHERE id=?", (event.request_id,)).fetchone()
                if (not row or row[0] != event.user_id or event.place_id not in
                        [x["place_id"] for x in json.loads(row[1])["recommendations"]]):
                    raise Conflict("request_id không chứa địa điểm hoặc không thuộc người dùng")
                if data["occurred_at"] < row[2]:
                    raise Conflict("Tương tác không được xảy ra trước lần hiển thị")
            db.execute("INSERT INTO events VALUES (?,?,?,?,?)", (
                event.event_id, event.user_id, event.place_id, data["occurred_at"], serialized))
        return True

    def log_impression(self, result, occurred_at):
        with self.connection() as db:
            db.execute("INSERT INTO impressions VALUES (?,?,?,?)", (
                result["request_id"], result["user_id"], occurred_at, json.dumps(result, ensure_ascii=False)))

    def impression(self, request_id):
        with self.connection() as db:
            row = db.execute("SELECT data FROM impressions WHERE id=?", (request_id,)).fetchone()
        if not row:
            raise NotFound("Không tìm thấy lần hiển thị")
        return json.loads(row[0])

    def add_exposure(self, event):
        from datetime import timezone
        data = event.model_dump(mode="json")
        data["occurred_at"] = event.occurred_at.astimezone(timezone.utc).isoformat()
        serialized = json.dumps(data, sort_keys=True, ensure_ascii=False)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            existing = db.execute("SELECT data FROM exposures WHERE id=?", (event.event_id,)).fetchone()
            if existing:
                if existing[0] != serialized:
                    raise Conflict("event_id hiển thị đã được dùng với nội dung khác")
                return False
            row = db.execute("SELECT user_id,data,occurred_at FROM impressions WHERE id=?", (event.request_id,)).fetchone()
            if not row:
                raise NotFound("Không tìm thấy request_id")
            allowed = {x["place_id"] for x in json.loads(row[1])["recommendations"]}
            if row[0] != event.user_id or not set(event.place_ids) <= allowed:
                raise Conflict("Danh sách hiển thị không thuộc request hoặc người dùng")
            if data["occurred_at"] < row[2]:
                raise Conflict("Thời điểm hiển thị không được trước request")
            db.execute("INSERT INTO exposures VALUES (?,?,?)", (event.event_id, event.request_id, serialized))
        return True

