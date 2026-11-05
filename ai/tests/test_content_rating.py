"""Contracts for the active content + rating stage, independent of user behavior."""
import json
import os
import unittest
from unittest.mock import patch

from app.core.config import RankingConfig
from app.modules.recommendation.hybrid_service import RecommendationService
from tests import test_recommendation as fixtures
from tests import test_trip_planner as planner_fixtures


class ContentRatingTests(unittest.TestCase):
    seed = fixtures.APITests.seed
    recommend = fixtures.APITests.recommend
    event = fixtures.APITests.event

    def setUp(self):
        self.ranking_config = RankingConfig()
        fixtures.APITests.setUp(self)

    tearDown = fixtures.APITests.tearDown

    def test_active_default_and_artifact_is_not_loaded(self):
        self.assertEqual(self.ranking_config.mode, "content_rating")
        with patch.dict(os.environ, {"REC_MODE": "content_rating", "REC_ITEM_KNN_MODEL_PATH": "/missing.json"}):
            svc = RecommendationService(self.app.state.recommendation.store, self.embedding, self.qdrant,
                                        config=RankingConfig.from_env())
        self.assertIsNone(svc.trained_collaborative)
        self.assertTrue(svc.version.startswith("content-rating-v1-"))
        self.assertEqual(svc.status()["collaborative_source"], "disabled")
        self.assertAlmostEqual(svc.status()["active_ranking_config"]["content_weight"], .75)
        with patch.dict(os.environ, {"REC_MODE": "typo"}):
            with self.assertRaises(ValueError):
                RankingConfig.from_env()

    def test_content_rating_weights_and_score_contract(self):
        self.seed(fixtures.place("sea", description="biển " * 20),
                  fixtures.place("mountain", description="núi " * 20))
        result = self.recommend(query="biển", preferences=[])
        self.assertEqual(result["strategy"], "content_rating")
        self.assertEqual(result["recommendations"][0]["place_id"], "sea")
        for item in result["recommendations"]:
            self.assertAlmostEqual(item["effective_weights"]["content"], .75)
            self.assertAlmostEqual(item["effective_weights"]["quality"], .25)
            self.assertAlmostEqual(item["score"], .75 * (item["content_score"] + 1) / 2 + .25 * item["quality_score"])
            self.assertIsNone(item["collaborative_score"])
            self.assertEqual(item["rating"], 4.5)
            self.assertEqual(item["review_count"], 100)

    def test_rating_fallback_shrinks_tiny_sample_and_orders_scores(self):
        self.seed(fixtures.place("tiny", rating=5, review_count=1),
                  fixtures.place("trusted", rating=4.7, review_count=2000),
                  fixtures.place("baseline", rating=4.2, review_count=20000),
                  fixtures.place("missing", rating=None, review_count=0))
        result = self.recommend(preferences=[])
        self.assertEqual(result["strategy"], "rating_fallback")
        self.assertEqual(result["recommendations"][0]["place_id"], "trusted")
        for item in result["recommendations"]:
            self.assertIsNone(item["content_score"])
            self.assertEqual(item["effective_weights"], {"quality": 1})
            self.assertEqual(item["score"], item["quality_score"])

    def test_behavior_has_no_influence_and_is_not_read(self):
        self.seed(fixtures.place("a"), fixtures.place("b"))
        before = self.recommend(query="biển")
        self.assertEqual(self.event("a", "dismiss").status_code, 200)
        self.assertEqual(self.event("b", "favorite").status_code, 200)
        svc = self.app.state.recommendation
        with patch.object(svc.store, "events", side_effect=AssertionError("must not read behavior")), \
                patch.object(svc.store, "recent_exposures", side_effect=AssertionError("must not read exposures")), \
                patch.object(svc, "_collaborative", side_effect=AssertionError("must not run ItemKNN")):
            after = self.recommend(query="biển", exclude_seen=True, exploration=True)
        self.assertEqual(before["recommendations"], after["recommendations"])
        self.assertFalse(after["diagnostics"]["history_used"])
        self.assertEqual(len(after["warnings"]), 2)
        self.assertTrue(all(not p["is_exploration"] and p["repeat_penalty"] == 0 for p in after["recommendations"]))

    def test_explicit_preferences_and_request_override(self):
        self.seed(fixtures.place("sea", description="biển " * 20),
                  fixtures.place("mountain", description="núi " * 20))
        self.client.put("/api/v1/users/u/preferences", json={"preferences": ["núi"]})
        self.assertEqual(self.recommend()["recommendations"][0]["place_id"], "mountain")
        self.assertEqual(self.recommend(preferences=["biển"])["recommendations"][0]["place_id"], "sea")
        self.assertEqual(self.recommend(preferences=[])["strategy"], "rating_fallback")

    def test_filters_and_distance_are_constraints_not_score(self):
        self.seed(fixtures.place("a", latitude=16.2), fixtures.place("z", latitude=16.05),
                  fixtures.place("other", city="Huế"), fixtures.place("inactive", active=False))
        result = self.recommend(query="biển", city="Đà Nẵng", latitude=16.05, longitude=108.2)
        self.assertEqual([p["place_id"] for p in result["recommendations"]], ["a", "z"])
        self.assertEqual(result["recommendations"][0]["score"], result["recommendations"][1]["score"])
        self.assertTrue(all(p["distance_score"] is None for p in result["recommendations"]))
        nearby = self.recommend(query="biển", city="Đà Nẵng", latitude=16.05, longitude=108.2, radius_km=1)
        self.assertEqual([p["place_id"] for p in nearby["recommendations"]], ["z"])
        self.assertEqual(self.recommend(city="Đà Nẵng", exclude_place_ids=["a", "z"])["total"], 0)
        self.assertEqual(self.recommend(budget="low")["total"], 0)
        self.assertEqual(self.recommend(family_friendly=True)["total"], 0)

    def test_outage_has_exact_fallback_with_same_scores(self):
        self.seed(fixtures.place("a"), fixtures.place("b", tags=["núi"]))
        expected = self.recommend(preferences=["biển"])
        with patch.object(self.app.state.recommendation.content, "candidates", side_effect=RuntimeError("offline")):
            actual = self.recommend(preferences=["biển"])
        self.assertEqual(actual["retrieval"], "local_exact")
        self.assertEqual(actual["recommendations"], expected["recommendations"])

    def test_missing_vector_is_reported_and_uses_rating(self):
        self.seed(fixtures.place("a"))
        svc = self.app.state.recommendation
        with svc.store.connection() as db:
            db.execute("UPDATE places SET model='stale' WHERE id='a'")
        result = self.recommend(query="biển")
        self.assertIsNone(result["recommendations"][0]["content_score"])
        self.assertEqual(result["recommendations"][0]["effective_weights"], {"quality": 1})
        self.assertEqual(len(result["warnings"]), 1)

    def test_rating_metadata_update_reuses_embedding(self):
        p = fixtures.place("a", rating=3, review_count=50)
        self.seed(p)
        before = self.recommend(query="biển")["recommendations"][0]
        calls = self.embedding.calls
        self.seed({**p, "rating": 5, "review_count": 500})
        self.assertEqual(self.embedding.calls, calls)
        after = self.recommend(query="biển")["recommendations"][0]
        self.assertGreater(after["quality_score"], before["quality_score"])
        self.assertGreater(after["score"], before["score"])
        self.assertAlmostEqual(after["content_score"], before["content_score"])

    def test_dedup_and_repeat_requests_are_deterministic(self):
        self.seed(fixtures.place("a", name="Cùng tên"), fixtures.place("b", name="Cùng tên"),
                  fixtures.place("c", name="Tên khác"))
        first = self.recommend(query="biển", exploration=True)
        second = self.recommend(query="biển", exploration=True)
        self.assertEqual(first["total"], 2)
        self.assertEqual(first["recommendations"], second["recommendations"])

    def test_trip_planner_can_use_active_ranker(self):
        planner_fixtures.PlannerTests.seed_trip(self, n=4)
        with patch.dict(os.environ, {"TRIP_OSRM_URL": "", "TRIP_OSRM_DRIVING_URL": ""}):
            result = self.client.post("/api/v1/trips", json={"user_id": "u", "city": "Đà Nẵng",
                "start_date": "2026-11-05", "days": 1, "stops_per_day": 3, "preferences": ["văn hóa"]})
        self.assertEqual(result.status_code, 201, result.text)
        self.assertEqual(result.json()["status"], "planned")
        self.assertEqual(len(result.json()["days"][0]["activities"]), 3)
