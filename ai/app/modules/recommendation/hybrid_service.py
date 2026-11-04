from app.core.config import RankingConfig, env
from .training import TrainedItemKNN
from app.core.geo import distance_km
from .interaction_weights import aggregate_events
from .collaborative import collaborative_scores
from .profiles import build_interests
from .place_document import place_document, DOCUMENT_VERSION
from .ranking import bayesian_quality, score_candidate
from .eligibility import eligible_for_request, ELIGIBILITY_VERSION, display_identity
"""Adaptive, explainable ranking with persistent feedback and honest cold-start fallback."""
import hashlib
import json
import logging
import math
import os
import random
import threading
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
from .content_based import ContentBasedRecommender, normalize
from .schemas import PlaceData, RecommendationResponse

logger = logging.getLogger(__name__)
RANKING_VERSION='multi-interest-v2-name-diversity-v1'


class RecommendationService:
    def __init__(self, store, embedding, qdrant, collection="documents_bge_m3", vector_name="dense", config=None):
        self.store, self.embedding = store, embedding
        self.config = config or RankingConfig.from_env()
        self.content = ContentBasedRecommender(qdrant, embedding, collection, vector_name)
        self.model = f"{embedding.model_name}:{embedding.dimensions}:{DOCUMENT_VERSION}"
        artifact_path=env("REC_ITEM_KNN_MODEL_PATH")
        self.trained_collaborative=TrainedItemKNN.load(artifact_path) if artifact_path else None
        fingerprint=self.trained_collaborative.fingerprint if self.trained_collaborative else ""
        self.version = "hybrid-v2-" + hashlib.sha256((self.model + ELIGIBILITY_VERSION + RANKING_VERSION + json.dumps(self.config.__dict__, sort_keys=True)+fingerprint).encode()).hexdigest()[:10]
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
        return {"saved_reviews":len(reviews), "places":{"saved":0,"pending_index":0,"items":[]},
                "note":"Reviews stored separately; factual place vectors are unchanged"}

    def reindex(self, limit=100):
        rows = [r for r in self.store.places() if not r["indexed"] or r["model"] != self.model or not r["content_hash"]]
        return self.upsert_places([PlaceData.model_validate_json(r["data"]) for r in rows[:limit]])

    def _profile(self, request, rows, aggregated):
        profile=build_interests(self.embedding,request,rows,aggregated,self.store,self.model,self.config.max_interest_groups)
        return profile if profile.queries else None

    def _collaborative(self, aggregated, user_id):
        if self.config.collaborative_weight<=0:return {}
        if self.trained_collaborative:
            if self.trained_collaborative.artifact.get("users",0)>=self.config.min_collaborative_users:
                return self.trained_collaborative.score(aggregated,user_id)
            return {}
        return collaborative_scores(aggregated,user_id,self.config.min_collaborative_users)

    def _vector(self,row):
        if not row['vector'] or row['model']!=self.model or not row['content_hash']:return None
        vector=normalize(json.loads(row['vector']))
        return vector if vector is not None and vector.shape==(self.embedding.dimensions,) else None

    def recommend(self, request, *, now=None, log=True):
        now = now or datetime.now(timezone.utc)
        rows = self.store.places()
        events = self.store.events()
        aggregated, blocked = aggregate_events(events, now, self.config.half_life_days)
        profile = self._profile(request, rows, aggregated)
        collaborative = self._collaborative(aggregated, request.user_id)
        excluded = set(request.exclude_place_ids) | {pid for uid, pid in blocked if uid == request.user_id}
        seen = {e["place_id"] for e in events if e["user_id"] == request.user_id}
        if request.exclude_seen:
            excluded |= seen
        candidates = []
        service_excluded=0
        exposures = self.store.recent_exposures(request.user_id,now)
        exposure_by_name=Counter()
        for row in rows:
            if exposures.get(row['id'],0):
                exposure_by_name[display_identity(json.loads(row['data']))]+=exposures[row['id']]
        priors = defaultdict(list)
        for row in rows:
            p = json.loads(row["data"])
            if p["active"] and eligible_for_request(p,request) and p["rating"] is not None and p["review_count"] > 0:
                priors[(p["city"].casefold(),p["place_type"])].append((p["rating"], p["review_count"]))
        means = {kind: sum(r*n for r,n in values) / sum(n for _,n in values) for kind,values in priors.items()}
        for row in rows:
            p = json.loads(row["data"])
            if not p["active"] or p["place_id"] in excluded:
                continue
            if request.city and p["city"].casefold() != request.city.casefold():
                continue
            if request.place_type and p["place_type"] != request.place_type:
                continue
            if request.category and request.category.casefold() not in {c.casefold() for c in p["categories"]}:
                continue
            # Unknown values cannot satisfy explicit hard filters. No constraints are silently relaxed.
            if request.budget and (p["budget"] or "").casefold() != request.budget.casefold():
                continue
            if request.family_friendly is not None and p["family_friendly"] is not request.family_friendly:
                continue
            distance = None
            if request.latitude is not None and p["latitude"] is not None:
                distance = distance_km(request.latitude, request.longitude, p["latitude"], p["longitude"])
            if request.radius_km is not None and (distance is None or distance > request.radius_km):
                continue
            if not eligible_for_request(p,request):
                service_excluded+=1
                continue
            mean = means.get((p["city"].casefold(),p["place_type"]), 3.5)
            count = p["review_count"] if p["rating"] is not None else 0
            quality = bayesian_quality(p["rating"],count,mean,self.config.prior_strength)
            vector = None  # Decode vectors only after candidate retrieval.
            cosine = None  # Compute only for the final candidate pool, unless exact fallback is needed.
            candidates.append({"p": p, "row":row,"v": vector, "content": cosine, "quality": quality, "distance": distance})
        retrieval = "quality_fallback" if profile is None else "qdrant"
        if profile is not None and candidates:
            try:
                # Filters are checked against SQLite too, so stale payloads never bypass constraints.
                retrieved=set()
                per_interest=max(1,math.ceil(self.config.candidate_limit/len(profile.queries)))
                retrieval_request=request.model_copy(update={'exclude_place_ids':sorted(excluded)})
                for query in profile.queries:
                    retrieved.update(self.content.candidates(query,retrieval_request,self.model,per_interest))
                retrieved.intersection_update(c['p']['place_id'] for c in candidates)
                if not retrieved:
                    retrieval = "local_exact"
            except Exception:
                logger.warning("Qdrant unavailable; using local exact retrieval", exc_info=True)
                retrieved, retrieval = set(), "local_exact"
            if retrieval == "local_exact":
                for c in candidates:
                    c['v']=self._vector(c['row']);c["content"]=profile.score(c["v"])
                retrieved = {x["p"]["place_id"] for x in sorted(candidates, key=lambda x: x["content"] if x["content"] is not None else -2, reverse=True)[:self.config.candidate_limit]}
            # Merge quality, geo, collaborative, pending-index sources; don't let ANN exclude fallback candidates.
            pool = set(retrieved)
            pool.update(x["p"]["place_id"] for x in sorted(candidates, key=lambda x: x["quality"], reverse=True)[:100])
            pool.update(x["p"]["place_id"] for x in sorted(candidates, key=lambda x: x["distance"] if x["distance"] is not None else math.inf)[:100])
            pool.update(pid for pid, _ in sorted(collaborative.items(), key=lambda x: x[1], reverse=True)[:100])
            pool.update(r["id"] for r in rows if not r["indexed"])
            candidates = [x for x in candidates if x["p"]["place_id"] in pool]
        if profile is None:
            cold_pool={c['p']['place_id'] for c in sorted(candidates,key=lambda c:(-c['quality'],c['p']['place_id']))[:self.config.candidate_limit]}
            if request.latitude is not None:
                cold_pool.update(c['p']['place_id'] for c in sorted(candidates,key=lambda c:c['distance'] if c['distance'] is not None else math.inf)[:100])
            cold_pool.update(pid for pid,_ in sorted(collaborative.items(),key=lambda x:(-x[1],x[0]))[:100])
            candidates=[c for c in candidates if c['p']['place_id'] in cold_pool]
        for c in candidates:
            if c['v'] is None:c['v']=self._vector(c['row'])
            c["content"]=profile.score(c["v"]) if profile is not None else None
            pid = c["p"]["place_id"]
            ds = 2 ** (-c["distance"] / self.config.distance_half_km) if c["distance"] is not None else None
            c["score"],effective,penalty=score_candidate(c["content"],c["quality"],ds,
                collaborative.get(pid,0) if collaborative else None,
                profile.confidence if profile is not None else 0,self.config,exposure_by_name.get(display_identity(c['p']),0))
            reasons = []
            if c["content"] is not None and c["content"] > 0.3:
                reasons.append("Nội dung gần với sở thích hoặc yêu cầu hiện tại")
            if c["p"]["rating"] is not None:
                reasons.append("Có điểm chất lượng được điều chỉnh theo số lượt đánh giá")
            if ds is not None:
                reasons.append(f"Cách vị trí yêu cầu khoảng {c['distance']:.1f} km")
            if collaborative.get(pid, 0) > 0:
                reasons.append("Có tín hiệu đồng tương tác từ cộng đồng")
            if penalty>0:reasons.append("Giảm lặp lại các địa điểm đã thực sự hiển thị gần đây")
            c["item"] = {"effective_weights":effective,"repeat_penalty":penalty,"place_id": pid, "name": c["p"]["name"], "place_type": c["p"]["place_type"],
                "city": c["p"]["city"], "score": c["score"], "content_score": c["content"],
                "quality_score": c["quality"], "distance_score": ds, "distance_km": c["distance"],
                "collaborative_score": collaborative.get(pid, 0) if collaborative else None,
                "reasons": reasons or ["Gợi ý dự phòng trong phạm vi yêu cầu"], "image_url": c["p"]["image_url"], "is_exploration": False}
        request_id = str(uuid.uuid4())
        selected = []
        same_name_suppressed=0
        remaining = sorted(candidates, key=lambda c: (-c["score"], c["p"]["place_id"]))
        explore_count = min(request.limit - 1, max(1, int(request.limit * self.config.exploration_rate))) if (
            request.exploration and self.config.exploration_rate > 0 and request.limit >= 5 and len(remaining) > request.limit) else 0
        while remaining and len(selected) < request.limit - explore_count:
            def adjusted(c):
                similarity = max((max(0, float(np.dot(c["v"], s["v"]))) for s in selected
                                  if c["v"] is not None and s["v"] is not None), default=0)
                return c["score"] - self.config.diversity_penalty * similarity
            best = max(remaining, key=adjusted)
            selected.append(best)
            before=len(remaining)
            remaining = [c for c in remaining if display_identity(c['p'])!=display_identity(best['p'])]
            same_name_suppressed+=before-len(remaining)-1
        if explore_count:
            unseen = [c for c in remaining if c["p"]["place_id"] not in seen]
            pool = unseen or remaining
            # Explore within top remaining quality candidates, obeying every hard filter.
            pool = sorted(pool, key=lambda c: c["quality"], reverse=True)[:max(20, request.limit * 2)]
            random.Random(request_id).shuffle(pool)
            identities={display_identity(c['p']) for c in selected};added=0
            for c in pool:
                if added>=explore_count:break
                identity=display_identity(c['p'])
                if identity in identities:
                    same_name_suppressed+=1
                    continue
                c["item"]["is_exploration"] = True
                c["item"]["reasons"].append("Địa điểm được chọn để khám phá thêm")
                selected.append(c)
                identities.add(identity);added+=1
        strategy = "adaptive_hybrid" if collaborative else "content_quality_context" if profile is not None else "quality_context_fallback"
        result = RecommendationResponse(request_id=request_id, user_id=request.user_id, total=len(selected),
            strategy=strategy, model_version=self.version, retrieval=retrieval,
            recommendations=[c["item"] for c in selected],diagnostics={
                "interest_groups":len(profile.groups) if profile is not None else 0,
                "profile_confidence":profile.confidence if profile is not None else 0,
                "collaborative_active":bool(collaborative),"candidate_count":len(candidates),
                "service_only_excluded":service_excluded,
                "same_name_suppressed":same_name_suppressed,
                "document_version":DOCUMENT_VERSION,"score_is_probability":False}).model_dump(mode="json")
        if log:
            self.store.log_impression(result, now.isoformat())
        return result

    def status(self):
        rows = self.store.places()
        return {"collection":self.content.collection,"vector_name":self.content.vector_name,
                "document_version":DOCUMENT_VERSION,"reviews_in_place_vector":False,
                "places": len(rows), "pending_index": sum(not r["indexed"] or r["model"] != self.model or not r["content_hash"] for r in rows),
                "embedding_model": self.model, "model_version": self.version, "ranking_config": self.config.__dict__,
                "collaborative_source":"trained_item_knn" if self.trained_collaborative else "online_item_knn",
                "learning": "Profile updates on each request; ItemKNN uses a configured trained artifact or live co-interactions. No automatic ranking-weight training."}
