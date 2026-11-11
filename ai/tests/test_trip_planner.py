import copy
import json
import os
import unittest
from datetime import datetime
from unittest.mock import patch
import test_recommendation as fixtures
from app.modules.trip_planner.route_matrix import RouteMatrix
from app.modules.trip_planner.schemas import TripRequest


class PlannerTests(unittest.TestCase):
    seed=fixtures.APITests.seed

    def setUp(self):
        fixtures.APITests.setUp(self)
        self.routing_env=patch.dict(os.environ,{"TRIP_OSRM_URL":"","TRIP_OSRM_DRIVING_URL":"",
            "TRIP_OSRM_WALKING_URL":"","TRIP_OSRM_CYCLING_URL":""})
        self.routing_env.start()

    def tearDown(self):
        self.routing_env.stop()
        fixtures.APITests.tearDown(self)

    def seed_trip(self,n=8,**kwargs):
        self.seed(*[fixtures.place(str(i),name="Bảo tàng "+str(i),categories=["Bảo tàng"],
                    latitude=16.05+i*0.002,longitude=108.2+i*0.002,duration_minutes=45,**kwargs) for i in range(n)])

    def request(self,**kwargs):
        return {"user_id":"u","city":"Đà Nẵng","start_date":"2026-11-02","days":2,
                "stops_per_day":3,"start_location":{"latitude":16.05,"longitude":108.2},"return_to_start":True,
                "preferences":["văn hóa"],**kwargs}

    def create(self,**kwargs):
        response=self.client.post("/api/v1/trips",json=self.request(**kwargs))
        self.assertEqual(response.status_code,201,response.text)
        return response.json()

    def test_create_multiday_valid_persisted_unique(self):
        self.seed_trip()
        trip=self.create()
        self.assertEqual(trip["status"],"planned")
        self.assertTrue(trip["routing"]["estimated"])
        ids=[a["place_id"] for day in trip["days"] for a in day["activities"]]
        self.assertEqual(len(ids),6)
        self.assertEqual(len(set(ids)),6)
        for day in trip["days"]:
            previous=None
            for activity in day["activities"]:
                start,end=map(datetime.fromisoformat,(activity["start_time"],activity["end_time"]))
                self.assertEqual((end-start).total_seconds()/60,activity["duration_minutes"])
                if previous:self.assertGreaterEqual(datetime.fromisoformat(activity["departure_time"]),previous)
                self.assertFalse(start.hour<13 and end.hour>=12 and (end.hour>12 or end.minute>0))
                previous=end
            self.assertIsNotNone(day["return_leg"])
            self.assertLessEqual(datetime.fromisoformat(day["end_time"]).hour,18)
        self.assertEqual(self.client.get(f"/api/v1/trips/{trip['trip_id']}?user_id=u").json(),trip)
        validation=self.client.get(f"/api/v1/trips/{trip['trip_id']}/validation?user_id=u").json()
        self.assertTrue(validation["valid"])
        self.assertEqual(validation["status"],"valid_with_assumptions")

    def test_opening_windows_closed_days_and_waiting(self):
        self.seed(fixtures.place("late",duration_minutes=60,weekly_opening_hours={"mon":[{"start":"14:00","end":"16:00"}]}),
                  fixtures.place("closed",closed_days="Thứ hai"))
        trip=self.create(days=1,stops_per_day=1,required_place_ids=["late"])
        activity=trip["days"][0]["activities"][0]
        self.assertTrue(activity["opening_hours_checked"])
        self.assertIn("T14:00",activity["start_time"])
        self.assertGreater(activity["waiting_minutes"],0)
        closed=self.create(days=1,stops_per_day=2,required_place_ids=["closed"])
        self.assertIn("closed",closed["unscheduled_required_place_ids"])
        self.assertEqual(closed["status"],"partial")

    def test_required_infeasible_daily_and_distance(self):
        self.seed(fixtures.place("far",latitude=20,longitude=108,duration_minutes=120))
        trip=self.create(days=1,required_place_ids=["far"],max_daily_distance_km=1)
        self.assertEqual(trip["days"][0]["activities"],[])
        self.assertEqual(trip["unscheduled_required_place_ids"],["far"])

    def test_missing_coords_and_unknown_id(self):
        self.seed(fixtures.place("missing",latitude=None,longitude=None))
        self.assertEqual(self.create()["status"],"partial")
        response=self.client.post("/api/v1/trips",json=self.request(required_place_ids=["unknown"]))
        self.assertEqual(response.status_code,422)

    def test_patch_day_preserves_other_day_and_version(self):
        self.seed_trip()
        trip=self.create()
        remove=trip["days"][0]["activities"][0]["place_id"]
        response=self.client.patch(f"/api/v1/trips/{trip['trip_id']}/days/1",json={
            "user_id":"u","expected_version":1,"remove_place_ids":[remove]})
        self.assertEqual(response.status_code,200,response.text)
        updated=response.json()
        self.assertEqual(updated["version"],2)
        self.assertEqual(updated["days"][1],trip["days"][1])
        self.assertNotIn(remove,[a["place_id"] for a in updated["days"][0]["activities"]])
        stale=self.client.patch(f"/api/v1/trips/{trip['trip_id']}/days/1",json={"user_id":"u","expected_version":1})
        self.assertEqual(stale.status_code,409)

    def test_failed_edit_keeps_original(self):
        self.seed_trip()
        trip=self.create()
        response=self.client.patch(f"/api/v1/trips/{trip['trip_id']}/days/1",json={
            "user_id":"u","expected_version":1,"window":{"start":"09:00","end":"09:10"}})
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(self.client.get(f"/api/v1/trips/{trip['trip_id']}?user_id=u").json(),trip)

    def test_ownership(self):
        self.seed_trip()
        trip=self.create()
        self.assertEqual(self.client.get(f"/api/v1/trips/{trip['trip_id']}?user_id=other").status_code,404)
        response=self.client.patch(f"/api/v1/trips/{trip['trip_id']}/days/1",json={"user_id":"other","expected_version":1})
        self.assertEqual(response.status_code,404)

    def test_extraction_and_chat_clarification_then_create(self):
        self.seed_trip()
        response=self.client.post("/api/v1/trip-planner/chat",json={"user_id":"u","message":"Lập lịch Đà Nẵng 2 ngày, thích biển"})
        self.assertEqual(response.status_code,200,response.text)
        data=response.json()
        self.assertEqual(data["status"],"needs_clarification")
        self.assertEqual(data["extraction"]["missing_fields"],["start_date"])
        response=self.client.post("/api/v1/trip-planner/chat",json={"user_id":"u","conversation_id":data["conversation_id"],"message":"Khởi hành 2026-11-02"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()["status"],"created")
        self.assertEqual(len(response.json()["trip"]["days"]),2)

    def test_chat_modifies_only_selected_day(self):
        self.seed_trip()
        trip=self.create()
        name=trip["days"][1]["activities"][0]["name"]
        response=self.client.post("/api/v1/trip-planner/chat",json={"user_id":"u","trip_id":trip["trip_id"],
            "expected_version":1,"message":f"Ngày 2 bỏ {name} đi"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()["status"],"updated")
        self.assertEqual(response.json()["trip"]["days"][0],trip["days"][0])
        follow=self.client.post("/api/v1/trip-planner/chat",json={"user_id":"u",
            "conversation_id":response.json()["conversation_id"],"message":"Tôi muốn đổi tiếp"})
        self.assertEqual(follow.status_code,200,follow.text)
        self.assertEqual(follow.json()["status"],"needs_clarification")
        self.assertFalse(follow.json()["extraction"]["missing_fields"])

    def test_visit_window_and_default_duration_flag(self):
        self.seed(fixtures.place("sunset",tags=["biển"]))
        trip=self.create(days=1,stops_per_day=1,required_place_ids=["sunset"],
                         visit_windows={"sunset":{"start":"16:00","end":"18:00"}},preferences=["hoàng hôn"])
        activity=trip["days"][0]["activities"][0]
        self.assertIn("T16:00",activity["start_time"])
        self.assertTrue(any("hoàng hôn" in w for w in trip["warnings"]))
        validation=self.client.get(f"/api/v1/trips/{trip['trip_id']}/validation?user_id=u").json()
        self.assertTrue(validation["assumptions"])

    def test_final_return_counts_for_distance_constraint(self):
        self.seed(fixtures.place("visit",latitude=16.10,longitude=108.2,duration_minutes=30))
        one_way=self.create(days=1,stops_per_day=1,return_to_start=False,max_daily_distance_km=10,required_place_ids=["visit"])
        returned=self.create(days=1,stops_per_day=1,return_to_start=True,max_daily_distance_km=10,required_place_ids=["visit"])
        self.assertEqual(one_way["status"],"planned")
        self.assertEqual(returned["status"],"partial")

    def test_unreachable_route_not_replaced_with_zero(self):
        self.seed_trip(1)
        matrix={"source":"osrm","estimated":False,"warnings":[],"minutes":[[0,None],[None,0]],"kilometers":[[0,None],[None,0]]}
        with patch("app.modules.trip_planner.route_matrix.RouteMatrix.build",return_value=matrix):
            trip=self.create(days=1,required_place_ids=["0"])
        self.assertEqual(trip["days"][0]["activities"],[])
        self.assertEqual(trip["status"],"partial")

    def test_extreme_date_rejected(self):
        response=self.client.post("/api/v1/trips",json=self.request(start_date="9999-12-31",days=2))
        self.assertEqual(response.status_code,422)

    def test_mixed_routing_metadata_after_edit(self):
        self.seed_trip()
        trip=self.create()
        original_build=RouteMatrix.build
        def road_matrix(instance,*args,**kwargs):
            result=original_build(instance,*args,**kwargs)
            return {**result,"source":"osrm","estimated":False}
        with patch.object(RouteMatrix,"build",road_matrix):
            edited=self.client.patch(f"/api/v1/trips/{trip['trip_id']}/days/1",json={"user_id":"u","expected_version":1})
        self.assertEqual(edited.status_code,200,edited.text)
        self.assertEqual(edited.json()["routing"]["source"],"mixed")
        self.assertTrue(edited.json()["routing"]["estimated"])
        self.assertEqual(edited.json()["days"][1],trip["days"][1])

    def test_empty_trip_validation_is_incomplete(self):
        trip=self.create(allow_estimated_routes=False)
        validation=self.client.get(f"/api/v1/trips/{trip['trip_id']}/validation?user_id=u").json()
        self.assertFalse(validation["complete"])
        self.assertEqual(validation["status"],"incomplete")

    def test_validation_detects_changed_catalog(self):
        self.seed_trip()
        trip=self.create(days=1,stops_per_day=1)
        pid=trip["days"][0]["activities"][0]["place_id"]
        self.seed(fixtures.place(pid,active=False))
        validation=self.client.get(f"/api/v1/trips/{trip['trip_id']}/validation?user_id=u").json()
        self.assertFalse(validation["valid"])

    def test_payload_validation_and_auth(self):
        for changes in [{"days":0},{"return_to_start":True,"start_location":None},
                        {"daily_window":{"start":"18:00","end":"09:00"}},
                        {"required_place_ids":["a"],"excluded_place_ids":["a"]}]:
            self.assertEqual(self.client.post("/api/v1/trips",json=self.request(**changes)).status_code,422)
        with patch.dict(os.environ,{"RECOMMENDATION_API_KEY":"secret"}):
            self.assertEqual(self.client.post("/api/v1/trips",json=self.request()).status_code,401)

    def test_empty_catalog_and_no_routing_fallback_allowed(self):
        self.assertEqual(self.create()["status"],"partial")
        self.seed_trip()
        with patch.dict(os.environ,{"TRIP_OSRM_URL":"","TRIP_OSRM_DRIVING_URL":""}):
            response=self.client.post("/api/v1/trips",json=self.request(allow_estimated_routes=False))
        self.assertEqual(response.status_code,503)

    def test_gemini_not_configured_and_mock_structured(self):
        with patch.dict(os.environ,{"GEMINI_API_KEY":"","GEMINI_MODEL":""}):
            response=self.client.post("/api/v1/trips/extract",json={"message":"Đi du lịch","use_llm":True})
            self.assertEqual(response.status_code,503)
        with patch("app.modules.trip_planner.requirement_extractor.RequirementExtractor.llm",return_value={"city":"Đà Nẵng","days":2,"start_date":"2026-11-02"}):
            response=self.client.post("/api/v1/trips/extract",json={"message":"Du lịch","use_llm":True})
        self.assertFalse(response.json()["needs_clarification"])




if __name__=="__main__":unittest.main()
