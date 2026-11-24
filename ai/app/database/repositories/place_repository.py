import json
from app.core.exceptions import Conflict, NotFound

class PlaceRepository:
    def places(self):
        with self.connection() as db:
            return [dict(row) for row in db.execute("SELECT * FROM places ORDER BY id")]

    def place(self, place_id):
        with self.connection() as db:
            row = db.execute("SELECT * FROM places WHERE id=?", (place_id,)).fetchone()
        if row is None:
            raise NotFound("Không tìm thấy địa điểm")
        return dict(row)

    def reviews(self, place_id):
        with self.connection() as db:
            rows = db.execute("SELECT data FROM reviews WHERE place_id=?", (place_id,))
            return [json.loads(row[0]) for row in rows]

    def save_reviews(self, reviews):
        with self.connection() as db:
            for review in reviews:
                if not db.execute("SELECT 1 FROM places WHERE id=?", (review.place_id,)).fetchone():
                    raise NotFound(f"Không tìm thấy địa điểm {review.place_id}")
                old = db.execute("SELECT place_id,data FROM reviews WHERE id=?", (review.review_id,)).fetchone()
                if old and old[0] != review.place_id:
                    raise Conflict("review_id không thể chuyển sang địa điểm khác")
                if old and old[1] == review.model_dump_json():
                    continue
                db.execute("INSERT INTO reviews VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
                           (review.review_id, review.place_id, review.model_dump_json()))
                # Factual vectors do not depend on opinion text.

