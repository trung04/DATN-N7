"""Place indexing and the current content-based + Bayesian rating service."""
import hashlib
import json
import logging
import threading


from app.core.config import RankingConfig
from app.core.vectors import normalize
from app.modules.semantic_search.vector_repository import PlaceVectorRepository
from .content_rating import recommend_content_rating
from .eligibility import ELIGIBILITY_VERSION
from .place_document import DOCUMENT_VERSION, place_document
from .schemas import PlaceData

logger = logging.getLogger(__name__)
RANKING_VERSION = "explicit-content-rating-name-dedup-v1"


class RecommendationService:
    def __init__(self, store, embedding, qdrant, collection="documents_bge_m3", vector_name="dense", config=None):
        self.store, self.embedding = store, embedding
        self.config = config or RankingConfig.from_env()
        self.content = PlaceVectorRepository(qdrant, embedding, collection, vector_name)
        self.model = f"{embedding.model_name}:{embedding.dimensions}:{DOCUMENT_VERSION}"
        signature = self.model + ELIGIBILITY_VERSION + RANKING_VERSION + json.dumps(self.config.__dict__, sort_keys=True)
        self.version = "content-rating-v1-" + hashlib.sha256(signature.encode()).hexdigest()[:10]
        self.lock = threading.RLock()

    def _text(self, place):
        return place_document(place, getattr(self.embedding, "max_text_length", 8000))

    def upsert_places(self, places, *, return_embeddings=False):
        results = []
        with self.lock:
            for item in places:
                place = item.model_dump(mode="json")
                text = self._text(place)
                digest = hashlib.sha256((self.model + text).encode()).hexdigest()
                with self.store.connection() as db:
                    old = db.execute("SELECT vector,content_hash,model FROM places WHERE id=?", (item.place_id,)).fetchone()
                reused = bool(old and old[1] == digest and old[2] == self.model and old[0])
                if reused:
                    vector = json.loads(old[0])
                else:
                    value = normalize(self.embedding.embed_text(text))
                    if value is None or len(value) != self.embedding.dimensions:
                        raise ValueError("Model trả embedding rỗng hoặc sai số chiều")
                    vector = value.tolist()
                with self.store.connection() as db:
                    db.execute("""INSERT INTO places VALUES (?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET
                        data=excluded.data,vector=excluded.vector,content_hash=excluded.content_hash,model=excluded.model,indexed=0""",
                        (item.place_id, json.dumps(place, ensure_ascii=False), json.dumps(vector), digest, self.model))
                indexed = True
                try:
                    self.content.upsert(place, vector, self.model)
                except Exception:
                    logger.exception("Qdrant indexing pending for %s", item.place_id)
                    indexed = False
                else:
                    with self.store.connection() as db:
                        db.execute("UPDATE places SET indexed=1 WHERE id=?", (item.place_id,))
                result = {"place_id": item.place_id, "indexed": indexed}
                if return_embeddings:
                    result.update({"point_id": self.content.point_id(item.place_id),
                        "model": self.embedding.model_name, "dimensions": self.embedding.dimensions,
                        "collection": self.content.collection, "vector_name": self.content.vector_name,
                        "embedding": vector, "content_hash": digest, "reused_embedding": reused})
                results.append(result)
        return {"saved": len(results), "pending_index": sum(not x["indexed"] for x in results), "items": results}

    def upsert_reviews(self, reviews):
        with self.lock:
            self.store.save_reviews(reviews)
        return {"saved_reviews": len(reviews), "places": {"saved": 0, "pending_index": 0, "items": []},
                "note": "Reviews stored separately; factual place vectors are unchanged"}

    def reindex(self, limit=100):
        rows = [r for r in self.store.places() if not r["indexed"] or r["model"] != self.model or not r["content_hash"]]
        return self.upsert_places([PlaceData.model_validate_json(r["data"]) for r in rows[:limit]])

    def _vector(self, row):
        if not row["vector"] or row["model"] != self.model or not row["content_hash"]:
            return None
        vector = normalize(json.loads(row["vector"]))
        return vector if vector is not None and vector.shape == (self.embedding.dimensions,) else None

    def recommend(self, request, *, now=None, log=True):
        return recommend_content_rating(self, request, now=now, log=log)

    def status(self):
        rows = self.store.places()
        total = self.config.content_weight + self.config.quality_weight
        return {"collection": self.content.collection, "vector_name": self.content.vector_name,
                "document_version": DOCUMENT_VERSION, "reviews_in_place_vector": False,
                "places": len(rows), "pending_index": sum(not r["indexed"] or r["model"] != self.model or not r["content_hash"] for r in rows),
                "embedding_model": self.model, "model_version": self.version, "mode": "content_rating",
                "ranking_config": {"content_weight": self.config.content_weight / total,
                                   "quality_weight": self.config.quality_weight / total,
                                   "prior_strength": self.config.prior_strength,
                                   "candidate_limit": self.config.candidate_limit,
                                   "max_interest_groups": self.config.max_interest_groups}}
