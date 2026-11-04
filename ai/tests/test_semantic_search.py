import json
import os
import unittest
from unittest.mock import patch

import test_recommendation as fixtures

place = fixtures.place


class PlaceSearchTests(unittest.TestCase):
    setUp = fixtures.APITests.setUp
    tearDown = fixtures.APITests.tearDown
    seed = fixtures.APITests.seed

    def search(self, query, **kwargs):
        result = self.client.post("/api/v1/search/places", json={"query": query, **kwargs})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def test_inferred_city_type_and_pool(self):
        self.seed(place("yes", place_type="Hotel", amenities=["Bể bơi ngoài trời"]),
                  place("no", place_type="Hotel"), place("wrong-city", city="Huế", place_type="Hotel", amenities=["Hồ bơi"]),
                  place("wrong-type", amenities=["Hồ bơi"]))
        result = self.search("Tìm khách sạn ở Đà Nẵng có hồ bơi")
        self.assertEqual([r["place_id"] for r in result["results"]], ["yes"])
        self.assertEqual(result["applied_filters"]["city"], "Đà Nẵng")
        self.assertEqual(result["applied_filters"]["amenities"], ["Bể bơi"])

    def test_explicit_filters_override_inference(self):
        self.seed(place("a", city="Huế", place_type="Hotel"), place("b", place_type="Hotel"))
        result = self.search("khách sạn ở Đà Nẵng", filters={"city": "Huế"})
        self.assertEqual([r["place_id"] for r in result["results"]], ["a"])
        self.assertTrue(any("ưu tiên" in w for w in result["warnings"]))

    def test_no_accents_and_exact_name_first(self):
        self.seed(place("a", name="Bảo tàng Chăm"), place("b", name="Biển Mỹ Khê"))
        result = self.search("Bao tang Cham", infer_filters=False)
        self.assertEqual(result["results"][0]["place_id"], "a")
        self.assertTrue(result["results"][0]["exact_name_match"])

    def test_filters_rating_category_radius_and_unknown(self):
        self.seed(place("a", rating=4.8, categories=["Bảo tàng"]),
                  place("b", rating=3, categories=["Bảo tàng"]), place("c", rating=None))
        filters = {"min_rating": 4, "category": "bao tang", "latitude": 16.05, "longitude":108.2, "radius_km":1}
        self.assertEqual([r["place_id"] for r in self.search("văn hóa", filters=filters)["results"]], ["a"])
        self.assertEqual(self.search("nghỉ dưỡng", filters={"budget":"low"})["total"],0)
        self.assertEqual(self.search("gia đình", filters={"family_friendly":True})["total"],0)

    def test_unsupported_requirements_visible(self):
        self.seed(place("a", place_type="Hotel"))
        result = self.search("khách sạn dưới 1 triệu gần biển đang mở cửa")
        self.assertGreaterEqual(len(result["unsupported_requirements"]),3)
        self.assertNotIn("price", result["applied_filters"])

    def test_negative_pool_and_unknown_metadata(self):
        self.seed(place("pool", place_type="Hotel", amenities=["Bể bơi"]),
                  place("unknown", place_type="Hotel"), place("wifi", place_type="Hotel", amenities=["Wi-Fi"]))
        result = self.search("Khách sạn không có hồ bơi")
        self.assertEqual([r["place_id"] for r in result["results"]],["wifi"])
        self.assertTrue(result["unsupported_requirements"])

    def test_optional_amenity_not_hard_filter(self):
        self.seed(place("a",place_type="Hotel"))
        result = self.search("Khách sạn không cần hồ bơi")
        self.assertEqual(result["total"],1)
        self.assertFalse(result["applied_filters"]["excluded_amenities"])

    def test_or_not_converted_to_and(self):
        self.seed(place("a",place_type="Hotel",amenities=["Spa"]))
        result = self.search("Khách sạn có spa hoặc hồ bơi")
        self.assertFalse(result["applied_filters"]["amenities"])
        self.assertTrue(any("hoặc" in w for w in result["warnings"]))

    def test_pagination_is_stable_and_no_exploration(self):
        self.seed(*[place(str(i)) for i in range(12)])
        first = self.search("biển", limit=5)
        again = self.search("biển", limit=5)
        second = self.search("biển", limit=5, offset=5)
        self.assertEqual(first["results"],again["results"])
        self.assertFalse({r["place_id"] for r in first["results"]} & {r["place_id"] for r in second["results"]})
        self.assertEqual(first["total"],12)

    def test_does_not_read_history_or_log_recommendation(self):
        self.seed(place("a"))
        svc=self.client.app.state.recommendation
        with patch.object(svc.store,"events",side_effect=AssertionError("Search must not read events")):
            self.search("biển")
        with svc.store.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM impressions").fetchone()[0],0)

    def test_stale_embedding_lexical_fallback(self):
        self.seed(place("a",name="Bảo tàng Chăm"))
        svc=self.client.app.state.recommendation
        with svc.store.connection() as db:
            db.execute("UPDATE places SET model='old'")
        result=self.search("Bảo tàng Chăm")
        self.assertEqual(result["total"],1)
        self.assertIsNone(result["results"][0]["semantic_score"])
        self.assertTrue(result["warnings"])
        self.assertEqual(self.search("Bảo tàng Chăm",min_similarity=0.1)["total"],0)

    def test_empty_and_no_constraint_relaxation(self):
        self.assertEqual(self.search("biển")["total"],0)
        self.seed(place("a"))
        self.assertEqual(self.search("biển",filters={"city":"Hà Nội"})["total"],0)

    def test_auth_and_validation(self):
        for body in [{"query":" "},{"query":"biển","limit":0},{"query":"biển","filters":{"radius_km":2}},
                     {"query":"biển","filters":{"amenities":["Hồ bơi"],"excluded_amenities":["Bể bơi"]}}]:
            self.assertEqual(self.client.post("/api/v1/search/places",json=body).status_code,422)
        with patch.dict(os.environ,{"RECOMMENDATION_API_KEY":"secret"}):
            self.assertEqual(self.client.post("/api/v1/search/places",json={"query":"biển"}).status_code,401)


if __name__ == "__main__":
    unittest.main()
