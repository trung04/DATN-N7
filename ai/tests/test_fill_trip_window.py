import copy
import unittest
from app.modules.trip_planner.schemas import TripRequest
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.modules.trip_planner.input_gate import check_inputs
from app.modules.recommendation.schemas import PlaceData
from tests import test_recommendation as fixtures


class FillTripWindowTests(unittest.TestCase):
    def build(self,fill=True,cap=None,closing=None):
        places=[{'place':PlaceData.model_validate(fixtures.place(str(i),duration_minutes=60,
                    opening_hours=closing or '09:00-18:00')).model_dump(mode='json'),'score':1-i*.01,'required':False} for i in range(12)]
        matrix={'source':'test','estimated':False,'warnings':[],
            'minutes':[[0 if i==j else 5 for j in range(12)] for i in range(12)],
            'kilometers':[[0 if i==j else 1 for j in range(12)] for i in range(12)]}
        engine=PlanningEngine(None);engine.candidates=lambda *a,**k:copy.deepcopy(places)
        engine.prepare=lambda *a:(copy.deepcopy(matrix),None)
        request=TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-12-01',days=1,
            fill_day=fill,daily_window={'start':'09:00','end':'18:00'})
        if cap is not None:request.day_stop_limits={1:cap}
        return engine.build(request)['days'][0]

    def test_fill_uses_more_than_default_three_stops_without_stretching_duration(self):
        short=self.build(False);full=self.build(True)
        self.assertEqual(len(short['activities']),3)
        self.assertGreater(len(full['activities']),3)
        self.assertGreaterEqual(full['end_time'][11:16],'16:00')
        self.assertLessEqual(full['end_time'][11:16],'18:00')
        self.assertLess(full['remaining_window_minutes'],65)
        self.assertTrue(all(a['duration_minutes']==60 for a in full['activities']))
        self.assertLessEqual(full['total_activity_minutes'],480)

    def test_explicit_cap_and_opening_hours_are_never_relaxed(self):
        self.assertEqual(len(self.build(True,cap=3)['activities']),3)
        day=self.build(True,closing='09:00-14:00')
        self.assertLessEqual(day['end_time'][11:16],'14:00')
        self.assertGreaterEqual(day['remaining_window_minutes'],240)

    def test_chat_defaults_to_fill_but_respects_explicit_stop_count(self):
        draft={'city':'Đà Nẵng','days':1,'start_date':'2099-12-01','preferences':['biển'],
            'party_size':2,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}}
        self.assertIsNone(check_inputs('lập lịch',draft,{}));self.assertTrue(draft['fill_day'])
        capped={**draft,'stops_per_day':3};capped.pop('fill_day')
        self.assertIsNone(check_inputs('3 điểm mỗi ngày',capped,{}));self.assertFalse(capped['fill_day'])
