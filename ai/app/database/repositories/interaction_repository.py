"""Append-only, idempotent user signals; kept separate from legacy event tables."""
import json
from datetime import datetime
from app.core.exceptions import Conflict, NotFound


class InteractionRepository:
    def save_interaction(self, user_id, event):
        data = event.model_dump(mode="json")
        data["occurred_at"] = event.occurred_at.isoformat()
        encoded = json.dumps(data, sort_keys=True, ensure_ascii=False)
        with self.connection() as db:
            old = db.execute("SELECT user_id,data FROM recommendation_interactions WHERE id=?",
                             (event.event_id,)).fetchone()
            if old:
                if old[0] != user_id or old[1] != encoded:
                    raise Conflict("event_id already used with different content")
                return False
            place = db.execute("SELECT data FROM places WHERE id=?", (event.place_id,)).fetchone()
            if not place or not json.loads(place[0])["active"]:
                raise NotFound("Active place not found")
            db.execute("INSERT INTO recommendation_interactions(id,user_id,place_id,occurred_at,data) VALUES(?,?,?,?,?)",
                       (event.event_id,user_id,event.place_id,data["occurred_at"],encoded))
        return True

    def interactions(self, user_id):
        with self.connection() as db:
            events = [json.loads(row[0]) for row in db.execute(
                "SELECT data FROM recommendation_interactions WHERE user_id=? ORDER BY occurred_at,id", (user_id,))]
        return sorted(events, key=lambda e: (datetime.fromisoformat(e['occurred_at']), e['event_id']))

    def clear_interactions(self, user_id):
        with self.connection() as db:
            return db.execute("DELETE FROM recommendation_interactions WHERE user_id=?", (user_id,)).rowcount
