"""Persist delivered recommendation results for later retrieval, not user behavior."""
import json

from app.core.exceptions import NotFound


class RecommendationRepository:
    def save_recommendation(self, result, occurred_at):
        # Keep the existing table name so older databases and saved requests remain readable.
        with self.connection() as db:
            db.execute("INSERT INTO impressions VALUES (?,?,?,?)", (
                result["request_id"], result["user_id"], occurred_at, json.dumps(result, ensure_ascii=False)))

    def recommendation(self, request_id):
        with self.connection() as db:
            row = db.execute("SELECT data FROM impressions WHERE id=?", (request_id,)).fetchone()
        if row is None:
            raise NotFound("Không tìm thấy lần đề xuất")
        result = json.loads(row[0])
        # Adapt saved responses from the retired ranker without rewriting historical records.
        retired_fields = {"collaborative_score", "distance_score", "repeat_penalty", "is_exploration"}
        for item in result.get("recommendations", []):
            for field in retired_fields:
                item.pop(field, None)
        return result
