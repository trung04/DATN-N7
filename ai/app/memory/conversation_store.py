import json
import uuid
from app.core.exceptions import NotFound

class ConversationStore:
    def __init__(self,store):
        self.store=store
        with store.connection() as db:
            db.execute("CREATE TABLE IF NOT EXISTS trip_conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL)")
    def get(self, conversation_id, user_id):
        if not conversation_id:
            return {"conversation_id":str(uuid.uuid4()),"draft":{},"messages":[],"trip_id":None}
        with self.store.connection() as db:
            row = db.execute("SELECT data FROM trip_conversations WHERE id=? AND user_id=?",(conversation_id,user_id)).fetchone()
        if not row:
            raise NotFound("Không tìm thấy hội thoại của người dùng")
        return json.loads(row[0])

    def save(self, user_id, data):
        data = {**data,"messages":data["messages"][-40:]}
        with self.store.connection() as db:
            db.execute("INSERT INTO trip_conversations VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
                (data["conversation_id"],user_id,json.dumps(data,ensure_ascii=False)))
