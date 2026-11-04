import json
from app.core.exceptions import Conflict, NotFound

class UserRepository:
    def preferences(self, user_id):
        with self.connection() as db:
            row = db.execute("SELECT preferences FROM users WHERE id=?", (user_id,)).fetchone()
        return json.loads(row[0]) if row else []

    def set_preferences(self, user_id, preferences):
        with self.connection() as db:
            db.execute("INSERT INTO users VALUES (?,?) ON CONFLICT(id) DO UPDATE SET preferences=excluded.preferences",
                       (user_id, json.dumps(preferences, ensure_ascii=False)))

