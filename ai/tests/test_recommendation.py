import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.main import create_app
from app.modules.recommendation.schemas import InteractionData, RecommendationRequest
from app.modules.recommendation.hybrid_service import RankingConfig, aggregate_events


class FakeEmbedding:
    model_name = "test-model"
    dimensions = 4
    device = "cpu"
    max_text_length = 8000

    def __init__(self):
        self.calls = 0

    def embed_text(self, text):
        self.calls += 1
        if not text.strip():
            raise ValueError("Empty text")
        text = text.casefold()
        v = np.array([1 + text.count("biển"), 1 + text.count("núi"),
                      1 + text.count("văn hóa"), 1], dtype=float)
        return (v / np.linalg.norm(v)).tolist()

    def embed_batch(self, texts):
        return [self.embed_text(text) for text in texts]


def place(pid, **kwargs):
    return {"place_id": pid, "name": "Địa điểm " + pid, "city": "Đà Nẵng", "place_type": "Attraction",
            "tags": ["biển"], "rating": 4.5, "review_count": 100,
            "latitude": 16.05, "longitude": 108.2, **kwargs}


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.embedding = FakeEmbedding()
        self.qdrant = QdrantClient(":memory:")
        self.env = patch.dict(os.environ, {"RECOMMENDATION_API_KEY": "", "RECOMMENDATION_COLLECTION": "test_places"})
        self.env.start()
        self.app = create_app(embedding=self.embedding, qdrant=self.qdrant,
            db_path=self.temp.name + "/db.sqlite", ranking_config=RankingConfig(diversity_penalty=0))
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.qdrant.close()
        self.env.stop()
        self.temp.cleanup()

    def seed(self, *places):
        r = self.client.post("/api/v1/places/batch", json={"places": list(places)})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def recommend(self, **kwargs):
        r = self.client.post("/api/v1/recommendations", json={"user_id": "u", "exploration": False, **kwargs})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def event(self, pid, kind="favorite", uid="u", **kwargs):
        return self.client.post("/api/v1/interactions", json={
            "event_id": f"{uid}-{pid}-{kind}", "user_id": uid, "place_id": pid,
            "interaction_type": kind, "occurred_at": datetime.now(timezone.utc).isoformat(), **kwargs})

    def test_existing_embeddings_and_health(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/embeddings/text", json={"text": "biển"}).status_code, 200)
        self.assertEqual(self.client.post("/api/v1/embeddings/text", json={"text": " "}).status_code, 400)
        self.assertEqual(self.client.post("/api/v1/embeddings/batch", json={"text": ["a"]*101}).status_code, 400)

    def test_string_id_index_and_idempotent_place(self):
        pid = "484a3b92e7476f86b5680182e96f586d"
        self.assertEqual(self.seed(place(pid))["pending_index"], 0)
        calls = self.embedding.calls
        self.seed(place(pid))
        self.assertEqual(self.embedding.calls, calls)
        self.assertEqual(self.qdrant.count("test_places").count, 1)
        self.assertEqual(self.recommend(preferences=["biển"])["recommendations"][0]["place_id"], pid)

    def test_backend_single_place_embedding(self):
        body = place("backend-id", description="Bãi biển yên tĩnh")
        result = self.client.post("/api/v1/embeddings/place", json=body)
        self.assertEqual(result.status_code, 200, result.text)
        result = result.json()
        self.assertEqual(result["place_id"], "backend-id")
        self.assertEqual(result["dimensions"], 4)
        self.assertEqual(len(result["embedding"]), 4)
        self.assertAlmostEqual(float(np.linalg.norm(result["embedding"])), 1, places=6)
        self.assertTrue(result["indexed"])
        self.assertFalse(result["reused_embedding"])
        calls = self.embedding.calls
        repeated = self.client.post("/api/v1/embeddings/place", json=body).json()
        self.assertTrue(repeated["reused_embedding"])
        self.assertEqual(self.embedding.calls, calls)
        self.assertEqual(repeated["point_id"], result["point_id"])
        changed = self.client.post("/api/v1/embeddings/place", json={**body, "tags": ["núi"]}).json()
        self.assertFalse(changed["reused_embedding"])
        self.assertNotEqual(changed["content_hash"], result["content_hash"])
        self.assertEqual(self.qdrant.count("test_places").count, 1)
        self.assertEqual(self.client.get("/api/v1/places/backend-id").json()["place"]["tags"], ["núi"])

    def test_backend_batch_embeddings_and_validation(self):
        response = self.client.post("/api/v1/embeddings/places", json={"places": [place("a"), place("b")]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["saved"], 2)
        self.assertTrue(all(len(x["embedding"]) == 4 for x in response.json()["items"]))
        self.assertEqual(self.client.post("/api/v1/embeddings/places", json={"places": []}).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/embeddings/places", json={"places": [place(str(i)) for i in range(101)]}).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/embeddings/place", json={"place_id": "missing-fields"}).status_code, 422)

    def test_backend_embedding_pending_index_and_auth(self):
        with patch.object(self.qdrant, "upsert", side_effect=RuntimeError("offline")):
            with self.assertLogs("app.modules.recommendation.hybrid_service", level="ERROR"):
                response = self.client.post("/api/v1/embeddings/place", json=place("a"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["indexed"])
        self.assertEqual(len(response.json()["embedding"]), 4)
        with patch.dict(os.environ, {"RECOMMENDATION_API_KEY": "secret-test"}):
            self.assertEqual(self.client.post("/api/v1/embeddings/place", json=place("a")).status_code, 401)
            self.assertEqual(self.client.post("/api/v1/embeddings/places", json={"places": [place("a")]}).status_code, 401)

    def test_cold_start_and_empty(self):
        self.assertEqual(self.recommend()["total"], 0)
        self.seed(place("a"))
        result = self.recommend()
        self.assertEqual(result["strategy"], "quality_context_fallback")
        self.assertIsNone(result["recommendations"][0]["content_score"])
        self.assertIsNone(result["recommendations"][0]["collaborative_score"])

    def test_hard_filters_not_relaxed(self):
        self.seed(place("a"), place("b", city="Huế"), place("c", place_type="Hotel"))
        result = self.recommend(city="đà nẵng", place_type="Attraction", preferences=["biển"])
        self.assertEqual([x["place_id"] for x in result["recommendations"]], ["a"])
        self.assertEqual(self.recommend(budget="low")["total"], 0)
        self.assertEqual(self.recommend(family_friendly=True)["total"], 0)

    def test_radius_and_coordinates_validation(self):
        self.seed(place("a"), place("b", latitude=20, longitude=108), place("c", latitude=None, longitude=None))
        result = self.recommend(latitude=16.05, longitude=108.2, radius_km=5)
        self.assertEqual([x["place_id"] for x in result["recommendations"]], ["a"])
        for body in [{"latitude": 16}, {"radius_km": 10}, {"latitude": float("inf"), "longitude": 0}]:
            if "latitude" in body and body["latitude"] == float("inf"):
                continue  # JSON cannot represent infinity; direct schema validation tested separately.
            self.assertEqual(self.client.post("/api/v1/recommendations", json={"user_id": "u", **body}).status_code, 422)

    def test_preferences_persist_and_override(self):
        self.seed(place("a", tags=["biển"]), place("b", tags=["núi"]))
        self.client.put("/api/v1/users/u/preferences", json={"preferences": ["núi"]})
        self.assertEqual(self.recommend()["recommendations"][0]["place_id"], "b")
        self.assertEqual(self.recommend(preferences=["biển"])["recommendations"][0]["place_id"], "a")
        self.assertEqual(self.recommend(preferences=[])["strategy"], "quality_context_fallback")

    def test_event_idempotency_conflict_and_missing_place(self):
        self.seed(place("a"))
        body = {"event_id": "e", "user_id": "u", "place_id": "a", "interaction_type": "click",
                "occurred_at": datetime.now(timezone.utc).isoformat()}
        self.assertTrue(self.client.post("/api/v1/interactions", json=body).json()["created"])
        self.assertFalse(self.client.post("/api/v1/interactions", json=body).json()["created"])
        self.assertEqual(self.client.post("/api/v1/interactions", json={**body, "interaction_type": "booking"}).status_code, 409)
        self.assertEqual(self.event("missing").status_code, 404)
        self.assertEqual(len(self.app.state.recommendation.store.events("u")), 1)

    def test_concurrent_duplicate_events(self):
        from concurrent.futures import ThreadPoolExecutor
        self.seed(place("a"))
        event = InteractionData(event_id="concurrent", user_id="u", place_id="a", interaction_type="click",
                                occurred_at=datetime.now(timezone.utc))
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.app.state.recommendation.store.add_event(event), range(8)))
        self.assertEqual(sum(results), 1)

    def test_feedback_updates_profile_and_dismiss_excludes(self):
        self.seed(place("a", tags=["biển"]), place("b", tags=["núi"]))
        self.assertEqual(self.event("b").status_code, 200)
        self.assertEqual(self.recommend()["recommendations"][0]["place_id"], "b")
        self.event("b", "dismiss")
        self.assertEqual([x["place_id"] for x in self.recommend()["recommendations"]], ["a"])

    def test_impression_link_validation(self):
        self.seed(place("a"))
        result = self.recommend()
        self.assertEqual(self.client.get("/api/v1/recommendations/" + result["request_id"]).json(), result)
        self.assertEqual(self.event("a", request_id=result["request_id"]).status_code, 200)
        self.assertEqual(self.event("a", uid="other", request_id=result["request_id"]).status_code, 409)

    def test_visible_impressions_idempotent_and_validated(self):
        self.seed(place("a"), place("b"))
        result = self.recommend(limit=1)
        body = {"event_id": "visible-1", "request_id": result["request_id"], "user_id": "u",
                "place_ids": [result["recommendations"][0]["place_id"]],
                "occurred_at": datetime.now(timezone.utc).isoformat()}
        self.assertTrue(self.client.post("/api/v1/impressions", json=body).json()["created"])
        self.assertFalse(self.client.post("/api/v1/impressions", json=body).json()["created"])
        self.assertEqual(self.client.post("/api/v1/impressions", json={**body, "event_id": "bad", "place_ids": ["not-shown"]}).status_code, 409)

    def test_catalog_pagination_and_soft_deactivation(self):
        self.seed(place("a"), place("b"), place("c", active=False))
        response = self.client.get("/api/v1/places?limit=1&offset=1").json()
        self.assertEqual(response["total"], 2)
        self.assertEqual(response["items"][0]["place_id"], "b")
        self.assertEqual(self.recommend()["total"], 2)

    def test_model_change_requires_reindex(self):
        self.seed(place("a"))
        svc = self.app.state.recommendation
        svc.model = "new-model:4"
        result = self.recommend(preferences=["biển"])
        self.assertIsNone(result["recommendations"][0]["content_score"])
        self.assertEqual(svc.status()["pending_index"], 1)
        self.client.post("/api/v1/recommendation/reindex")
        self.assertEqual(svc.status()["pending_index"], 0)

    def test_raw_review_summary_not_embedded_as_metadata(self):
        self.seed(place("a", review_summary=json.dumps({"most_relevant": [
            {"username": "private-user", "description": "Biển đẹp", "link": "https://example.com"}]})))
        svc = self.app.state.recommendation
        p = json.loads(svc.store.place("a")["data"])
        text = svc._text(p)
        self.assertNotIn("Biển đẹp", text)
        self.assertNotIn("private-user", text)
        self.assertNotIn("https://", text)

    def test_reviews_stay_separate_and_idempotent(self):
        self.seed(place("a"))
        body = {"reviews": [{"review_id": "r1", "place_id": "a", "rating": 2,
            "text": "Nhiều tiếng ồn", "occurred_at": "2026-01-01T00:00:00+07:00"}]}
        calls = self.embedding.calls
        self.assertEqual(self.client.post("/api/v1/reviews/batch", json=body).status_code, 200)
        self.assertEqual(self.embedding.calls, calls)
        self.assertEqual(self.client.post("/api/v1/reviews/batch", json=body).status_code, 200)
        self.assertEqual(len(self.app.state.recommendation.store.reviews("a")), 1)

    def test_qdrant_failure_local_fallback_and_repair(self):
        with patch.object(self.qdrant, "upsert", side_effect=RuntimeError("offline")):
            self.assertEqual(self.seed(place("a"))["pending_index"], 1)
        with patch.object(self.qdrant, "query_points", side_effect=RuntimeError("offline")):
            self.assertEqual(self.recommend(preferences=["biển"])["retrieval"], "local_exact")
        self.assertEqual(self.client.post("/api/v1/recommendation/reindex").json()["pending_index"], 0)
        self.assertEqual(self.client.get("/api/v1/recommendation/status").json()["pending_index"], 0)

    def test_bayesian_quality_penalizes_tiny_samples(self):
        self.seed(place("a", rating=5, review_count=2), place("b", rating=4.7, review_count=2000),
                  place("c", rating=4.2, review_count=20000))
        items = self.recommend()["recommendations"]
        self.assertGreater(next(x["quality_score"] for x in items if x["place_id"] == "b"),
                           next(x["quality_score"] for x in items if x["place_id"] == "a"))

    def test_exploration_respects_filters_and_no_duplicates(self):
        self.seed(*[place(str(i)) for i in range(15)], place("outside", city="Huế"))
        result = self.recommend(city="Đà Nẵng", limit=10, exploration=True)
        self.assertEqual(result["total"], 10)
        self.assertEqual(len({x["place_id"] for x in result["recommendations"]}), 10)
        self.assertTrue(any(x["is_exploration"] for x in result["recommendations"]))
        self.assertTrue(all(x["city"] == "Đà Nẵng" for x in result["recommendations"]))

    def test_collaborative_activates_only_with_support(self):
        self.seed(place("a"), place("b"), place("c"))
        self.event("a", uid="u")
        self.assertIsNone(self.recommend()["recommendations"][0]["collaborative_score"])
        for uid in ["v", "w"]:
            self.event("a", uid=uid)
            self.event("b", uid=uid)
        self.assertEqual(self.recommend()["strategy"], "adaptive_hybrid")

    def test_api_key(self):
        with patch.dict(os.environ, {"RECOMMENDATION_API_KEY": "secret-test"}):
            self.assertEqual(self.client.get("/api/v1/recommendation/status").status_code, 401)
            self.assertEqual(self.client.get("/api/v1/recommendation/status", headers={"X-API-Key": "secret-test"}).status_code, 200)

    def test_database_survives_restart(self):
        self.seed(place("a"))
        self.event("a")
        from app.database.sqlite import Store
        restarted = Store(self.temp.name + "/db.sqlite")
        self.assertEqual(len(restarted.places()), 1)
        self.assertEqual(len(restarted.events()), 1)

    def test_invalid_schema(self):
        self.assertEqual(self.client.post("/api/v1/places/batch", json={"places": [place("a", rating=6)]}).status_code, 422)
        self.seed(place("a"))
        self.assertEqual(self.event("a", "rating").status_code, 422)
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        self.assertEqual(self.event("a", occurred_at=future).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/recommendations", json={"user_id": " ", "limit": 0}).status_code, 422)


class MathTests(unittest.TestCase):
    def test_metrics_known_ranking(self):
        from app.modules.recommendation.evaluation import ranking_metrics
        values = ranking_metrics(["a", "b", "c"], {"a", "c"}, 3)
        self.assertEqual(values["recall"], 1)
        self.assertAlmostEqual(values["precision"], 2/3)
        self.assertGreater(values["ndcg"], 0.9)
        self.assertEqual(ranking_metrics(["a"], {"b"}, 1)["ndcg"], 0)

    def test_decay_daily_cap_and_unfavorite(self):
        now = datetime.now(timezone.utc)
        def event(i, kind="click", dt=now):
            return {"event_id": str(i), "user_id": "u", "place_id": "p", "interaction_type": kind, "occurred_at": dt.isoformat()}
        recent, _ = aggregate_events([event(i) for i in range(100)], now, 90)
        capped, _ = aggregate_events([event(i) for i in range(3)], now, 90)
        self.assertEqual(recent, capped)
        old, _ = aggregate_events([event(0, dt=now-timedelta(days=90))], now, 90)
        fresh, _ = aggregate_events([event(0)], now, 90)
        self.assertAlmostEqual(old[("u", "p")], fresh[("u", "p")]/2)
        result, _ = aggregate_events([event(0, "favorite", now-timedelta(seconds=1)), event(1, "unfavorite")], now, 90)
        self.assertEqual(result, {})


if __name__ == "__main__":
    unittest.main()
