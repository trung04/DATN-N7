import copy
import unittest
from datetime import date,datetime
from types import SimpleNamespace
from app.modules.trip_planner.schemas import TripRequest
from app.modules.trip_planner.input_gate import check_inputs
from app.modules.trip_planner.schedule_validator import schedule_route
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.modules.trip_planner.time_suitability import mark_sunset_candidates,sunset_minute
from app.modules.trip_planner.requirement_extractor import RequirementExtractor
from app.modules.trip_planner.visit_duration import prepare_durations
from app.modules.recommendation.schemas import PlaceData
from tests.test_recommendation import place


class TimeSuitabilityTests(unittest.TestCase):
    def req(self,**extra):
        return TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-12-01',days=1,fill_day=True,
            daily_window={'start':'08:00','end':'22:00'},**extra)
    def candidate(self,pid,name,duration=60,**extra):
        p=PlaceData.model_validate(place(pid,name=name,duration_minutes=duration,opening_hours='08:00-23:00',**extra)).model_dump(mode='json')
        return {'place':p,'score':.8,'required':False}
    def matrix(self,n):
        return {'source':'test','estimated':False,'warnings':[],
            'minutes':[[0 if i==j else 10 for j in range(n)] for i in range(n)],
            'kilometers':[[0 if i==j else 1 for j in range(n)] for i in range(n)]}
    def test_night_market_is_not_a_daytime_stop(self):
        cs=[self.candidate('night','Chợ đêm Sơn Trà')]
        day=schedule_route([0],1,self.req(activity_budget_mode='auto'),cs,self.matrix(1),None)
        self.assertGreaterEqual(day['activities'][0]['start_time'][11:16],'18:00')
        short=self.req(activity_budget_mode='auto').model_copy(update={'daily_window':self.req().daily_window.model_copy(update={'end':'17:00'})})
        self.assertIsNone(schedule_route([0],1,short,cs,self.matrix(1),None))
    def test_sunset_stop_covers_date_specific_sunset(self):
        req=self.req(activity_budget_mode='auto',preferences=['biển','hoàng hôn'])
        cs=mark_sunset_candidates(req,[self.candidate('sea','Bãi biển Sơn Trà',130)])
        setting=sunset_minute(date(2026,12,1),16.05,108.2)
        self.assertTrue(17*60<=setting<=17*60+30)
        day=schedule_route([0],1,req,cs,self.matrix(1),None)
        a=day['activities'][0]
        start=datetime.fromisoformat(a['start_time']);end=datetime.fromisoformat(a['end_time'])
        self.assertLessEqual(start.hour*60+start.minute,setting-10)
        self.assertGreaterEqual(end.hour*60+end.minute,setting+10)
        self.assertEqual(a['time_intent'],'sunset')
    def test_budget_matches_8_to_22_without_ignoring_explicit_cap(self):
        draft={'city':'Đà Nẵng','days':1,'start_date':'2099-12-01','preferences':['biển'],
            'party_size':2,'transport':'driving','daily_window':{'start':'08:00','end':'22:00'}}
        self.assertIsNone(check_inputs('lập lịch',draft,{}))
        self.assertEqual(draft['max_daily_activity_minutes'],780)
        req=self.req(activity_budget_mode='auto')
        self.assertEqual(req.activity_limit(1),780)
        self.assertEqual(self.req(max_daily_activity_minutes=300).activity_limit(1),300)
    def test_long_day_can_schedule_real_evening_candidates(self):
        cs=[self.candidate(str(i),'Điểm '+str(i),60) for i in range(12)]
        cs.append(self.candidate('market','Chợ đêm',60))
        engine=PlanningEngine(None);engine.candidates=lambda req:copy.deepcopy(cs)
        engine.prepare=lambda *args:(self.matrix(len(cs)),None)
        auto=engine.build(self.req(activity_budget_mode='auto'))
        limited=engine.build(self.req(max_daily_activity_minutes=480))
        self.assertGreaterEqual(auto['days'][0]['end_time'][11:16],'21:00')
        self.assertLessEqual(auto['days'][0]['end_time'][11:16],'22:00')
        self.assertLess(limited['days'][0]['end_time'],auto['days'][0]['end_time'])
        self.assertGreater(len(auto['days'][0]['activities']),len(limited['days'][0]['activities']))
    def test_new_window_migrates_unmarked_legacy_default(self):
        result=RequirementExtractor(SimpleNamespace(places=lambda:[])).extract('Từ 8h đến 22h',{'max_daily_activity_minutes':480},fields_override={})
        self.assertEqual(result['draft']['activity_budget_mode'],'auto')

    def test_three_days_keep_mornings_and_do_not_consume_all_night_markets_on_one_day(self):
        req=self.req(activity_budget_mode='auto',visit_duration_mode='adaptive',preferences=['biển','hoàng hôn']).model_copy(update={'days':3})
        cs=[self.candidate('sea'+str(i),'Bãi biển '+str(i)) for i in range(3)]
        cs += [self.candidate('day'+str(i),'Điểm văn hóa '+str(i),tags=['văn hóa']) for i in range(15)]
        cs += [self.candidate('night'+str(i),'Chợ đêm '+str(i)) for i in range(3)]
        prepare_durations(req,cs)
        engine=PlanningEngine(None);engine.candidates=lambda req:copy.deepcopy(cs)
        engine.prepare=lambda *args:(self.matrix(len(cs)),None)
        plan=engine.build(req)
        for day in plan['days']:
            self.assertEqual(day['activities'][0]['start_time'][11:16],'08:00')
            self.assertGreaterEqual(day['end_time'][11:16],'21:00')
            self.assertEqual(sum(a.get('time_intent')=='sunset' for a in day['activities']),1)
            self.assertLessEqual(sum(a.get('time_intent')=='night_market' for a in day['activities']),1)

    def test_unreachable_coast_is_not_forced_as_sunset_anchor(self):
        req=self.req(preferences=['hoàng hôn'])
        cs=[self.candidate(str(i),'Bãi biển '+str(i)) for i in range(3)]
        matrix=self.matrix(3)
        for j in (1,2):matrix['minutes'][0][j]=matrix['minutes'][j][0]=None
        mark_sunset_candidates(req,cs,matrix)
        self.assertFalse(cs[0].get('sunset_visit'))
        self.assertTrue(cs[1].get('sunset_visit'))

    def test_late_day_keeps_dinner_before_the_expandable_evening_visit(self):
        req=self.req(activity_budget_mode='auto',visit_duration_mode='adaptive',duration_overrides={'food':60}).model_copy(
            update={'daily_window':self.req().daily_window.model_copy(update={'start':'17:00'})})
        cs=[self.candidate('food','Nhà hàng',60,place_type='Restaurant'),self.candidate('night','Chợ đêm',50)]
        cs[1]['score']=.9;prepare_durations(req,cs)
        engine=PlanningEngine(None);engine.candidates=lambda req:copy.deepcopy(cs)
        engine.prepare=lambda *args:(self.matrix(2),None)
        day=engine.build(req)['days'][0]
        self.assertEqual(day['activities'][0]['place_id'],'food')
        self.assertEqual(day['activities'][-1]['place_id'],'night')
        self.assertEqual(day['end_time'][11:16],'22:00')

    def test_transport_business_is_not_an_automatic_sightseeing_stop(self):
        from app.modules.trip_planner.candidate_generator import transport_provider
        self.assertTrue(transport_provider({'place_type':'Attraction','name':'Da Nang Happy Car Travel'}))
        self.assertFalse(transport_provider({'place_type':'Attraction','name':'Bãi biển Mỹ Khê'}))

    def test_morning_repair_does_not_shift_the_empty_morning_to_another_day(self):
        req=self.req(activity_budget_mode='auto').model_copy(update={'days':2})
        cs=[self.candidate(str(i),'Điểm '+str(i),tags=['văn hóa']) for i in range(2)]
        cs += [self.candidate('food'+str(i),'Nhà hàng '+str(i),60,place_type='Restaurant') for i in range(2)]
        routes=[[0,1,2],[3]];matrix=self.matrix(4);engine=PlanningEngine(None)
        schedules=[schedule_route(route,day+1,req,cs,matrix,None) for day,route in enumerate(routes)]
        self.assertEqual(schedules[1]['activities'][0]['start_time'][11:16],'11:30')
        routes,schedules=engine.rebalance_mornings(req,cs,matrix,None,routes,schedules)
        self.assertTrue(all(d['activities'][0]['start_time'][11:16]=='08:00' for d in schedules))
        self.assertEqual(sorted(i for route in routes for i in route),list(range(4)))
