import json
import os
import unittest
from unittest.mock import patch
from app.modules.trip_planner.route_matrix import RouteMatrix


class ScheduleInvariants(unittest.TestCase):
    def test_break_and_return_leg_must_fit_day(self):
        from app.modules.trip_planner.schemas import TripRequest,TimeWindow
        from app.modules.trip_planner.schedule_validator import schedule_route
        from app.modules.recommendation.schemas import PlaceData
        request=TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-11-10',days=1,
            start_location={'latitude':16,'longitude':108},return_to_start=True,
            daily_window=TimeWindow(start='11:50',end='14:00'))
        place=PlaceData(place_id='a',name='Điểm tham quan',place_type='Attraction',city='Đà Nẵng',
            latitude=16,longitude=108,duration_minutes=30,opening_hours='24/7').model_dump(mode='json')
        candidates=[{'place':place,'score':1}]
        matrix={'source':'test','estimated':False,'minutes':[[0,20],[20,0]],'kilometers':[[0,2],[2,0]]}
        self.assertIsNone(schedule_route([0],1,request,candidates,matrix,1))
        request.daily_window=TimeWindow(start='11:50',end='14:10')
        result=schedule_route([0],1,request,candidates,matrix,1)
        self.assertIn('T13:20',result['activities'][0]['start_time'])
        self.assertIn('T14:10',result['return_leg']['arrival_time'])

class RoutingTests(unittest.TestCase):
    def test_matrix_units_and_null_unreachable(self):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return json.dumps({"code":"Ok","durations":[[0,120],[None,0]],"distances":[[0,1000],[None,0]]}).encode()
        with patch.dict(os.environ,{"TRIP_OSRM_URL":"https://routing.example"}),patch("app.modules.trip_planner.route_matrix.urlopen",return_value=Response()):
            matrix=RouteMatrix().build([{"latitude":0,"longitude":0},{"latitude":1,"longitude":1}],"driving",False)
        self.assertEqual(matrix["minutes"][0][1],2)
        self.assertEqual(matrix["kilometers"][0][1],1)
        self.assertIsNone(matrix["minutes"][1][0])
        self.assertFalse(matrix["estimated"])
