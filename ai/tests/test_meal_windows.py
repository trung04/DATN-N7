import unittest
from app.modules.trip_planner.schemas import TripRequest
from app.modules.trip_planner.schedule_validator import schedule_route
from app.modules.trip_planner.visit_duration import prepare_durations,distribute_spare_time
from app.modules.trip_planner.requirement_extractor import RequirementExtractor
from app.modules.recommendation.schemas import PlaceData
from tests.test_recommendation import place
from types import SimpleNamespace


class MealWindowTests(unittest.TestCase):
    def candidates(self):
        return [{'place':PlaceData.model_validate(place(str(i),place_type='Restaurant',duration_minutes=85,
                    opening_hours='09:00-22:00')).model_dump(mode='json'),'score':1,'required':False} for i in range(2)]
    def matrix(self):
        return {'source':'test','estimated':False,'warnings':[],'minutes':[[0,5],[5,0]],'kilometers':[[0,1],[1,0]]}
    def req(self,**extra):return TripRequest(user_id='u',city='Đà Nẵng',start_date='2099-12-01',days=1,fill_day=True,**extra)
    def test_default_lunch_can_replace_default_pause(self):
        day=schedule_route([0],1,self.req(),self.candidates(),self.matrix(),None)
        a=day['activities'][0]
        self.assertEqual(a['start_time'][11:16],'11:30')
        self.assertEqual(a['end_time'][11:16],'12:55')
        self.assertEqual(a['meal_slot'],'lunch')
        self.assertEqual(day['meal_pause_minutes'],55)
    def test_1633_restaurant_is_rejected_unless_explicitly_requested(self):
        req=self.req(daily_window={'start':'16:33','end':'18:00'})
        self.assertIsNone(schedule_route([0],1,req,self.candidates(),self.matrix(),None))
        req=req.model_copy(update={'meal_start_times':{'dinner':'16:33'}})
        a=schedule_route([0],1,req,self.candidates(),self.matrix(),None)['activities'][0]
        self.assertEqual(a['start_time'][11:16],'16:33')
        self.assertEqual(a['end_time'][11:16],'17:58')
    def test_one_meal_per_slot_and_dinner_starts_at_18(self):
        self.assertIsNone(schedule_route([0,1],1,self.req(),self.candidates(),self.matrix(),None))
        day=schedule_route([0,1],1,self.req(daily_window={'start':'11:30','end':'20:00'}),self.candidates(),self.matrix(),None)
        self.assertIsNotNone(day)
        self.assertEqual(day['activities'][1]['start_time'][11:16],'18:00')
        evening=schedule_route([0],1,self.req(daily_window={'start':'17:00','end':'21:00'}),self.candidates(),self.matrix(),None)
        self.assertEqual(evening['activities'][0]['start_time'][11:16],'18:00')
    def test_adaptive_extra_minutes_do_not_spill_past_lunch(self):
        req=self.req(visit_duration_mode='adaptive');cs=prepare_durations(req,self.candidates())
        day=distribute_spare_time([0],1,req,cs,self.matrix(),None,schedule_route)
        self.assertLessEqual(day['activities'][0]['end_time'][11:16],'13:30')
    def test_meal_time_change_keeps_day_window(self):
        extractor=RequirementExtractor(SimpleNamespace(places=lambda:[]))
        original={'daily_window':{'start':'09:00','end':'18:00'}}
        result=extractor.extract('Đổi ăn trưa lúc 14h',original,fields_override={})
        self.assertEqual(result['draft']['meal_start_times'],{'lunch':'14:00'})
        self.assertEqual(result['draft']['daily_window'],original['daily_window'])
    def test_explicit_rest_is_not_consumed_by_lunch(self):
        req=self.req(breaks=[{'start':'12:00','end':'13:00'}])
        self.assertIsNone(schedule_route([0],1,req,self.candidates(),self.matrix(),None))
