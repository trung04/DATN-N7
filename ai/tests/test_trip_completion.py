import copy
import io
import json
import unittest
from unittest.mock import patch
from app.modules.trip_planner.schemas import TripRequest
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.modules.trip_planner.route_objective import travel_cost
from app.modules.trip_planner.ors_matrix import OrsMatrix
from tests import test_recommendation as fixtures


def candidates(n,duration=30):
    return [{'place':fixtures.place(str(i),name='Place '+str(i),duration_minutes=duration),'score':1-i*.001,'required':True} for i in range(n)]


class EngineCompletionTests(unittest.TestCase):
    def test_optional_meals_leave_room_for_sightseeing_when_candidates_exist(self):
        places=candidates(14)
        for i,p in enumerate(places):p['required']=False;p['place']['place_type']='Restaurant' if i<8 else 'Attraction'
        matrix={'source':'test','estimated':False,'warnings':[],'minutes':[[0 if i==j else 5 for j in range(14)] for i in range(14)],'kilometers':[[0 if i==j else 1 for j in range(14)] for i in range(14)]}
        request=TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-12-25',days=3,stops_per_day=3)
        plan=self.engine(places,matrix).build(request)
        self.assertTrue(all(len(d['activities'])==3 and sum(a['place_type']=='Restaurant' for a in d['activities'])<=1 for d in plan['days']))
    def test_frozen_benchmark_cases_are_feasible_for_each_algorithm(self):
        # The benchmark is executable without search/model/provider dependencies.
        import importlib.util
        from pathlib import Path
        path=Path('/app/scripts/benchmark_trip_planner.py')
        if not path.exists():self.skipTest('Mount scripts/ to run benchmark integration')
        spec=importlib.util.spec_from_file_location('benchmark',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        results=module.run()
        self.assertEqual(len(results),12)
        self.assertTrue(all(r['feasible'] and r['scheduled']==r['candidates'] and r['same_selection_as_baseline'] for r in results))
    def engine(self,places,matrix):
        engine=PlanningEngine(None);engine.candidates=lambda *a,**k:copy.deepcopy(places)
        class Routing:
            def build(self,*a):return copy.deepcopy(matrix)
        engine.routing=Routing();return engine
    def req(self,**kw):return TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-12-10',days=1,stops_per_day=10,**kw)
    def test_multi_day_has_no_duplicates_and_respects_480(self):
        places=candidates(20);matrix={'source':'test','estimated':False,'warnings':[],
            'minutes':[[0 if i==j else 5 for j in range(20)] for i in range(20)],
            'kilometers':[[0 if i==j else 1 for j in range(20)] for i in range(20)]}
        for method in ['nearest_neighbor','greedy_insertion','greedy_2opt']:
            req=TripRequest(user_id='u',city='Đà Nẵng',start_date='2026-12-10',days=2,stops_per_day=10,required_place_ids=[str(i) for i in range(20)],optimizer=method)
            plan=self.engine(places,matrix).build(req)
            ids=[a['place_id'] for d in plan['days'] for a in d['activities']]
            self.assertEqual(len(ids),20);self.assertEqual(len(set(ids)),20)
            self.assertTrue(all(d['total_activity_minutes']<=480 for d in plan['days']))
    def test_no_route_required_and_missing_durations_are_explicit(self):
        places=candidates(2);places[0]['place']['duration_minutes']=None
        matrix={'source':'test','estimated':False,'warnings':[],'minutes':[[0,None],[None,0]],'kilometers':[[0,None],[None,0]]}
        plan=self.engine(places,matrix).build(self.req(required_place_ids=['0','1']))
        self.assertTrue(plan['unscheduled_required_place_ids'])
        self.assertTrue(any('giả định' in note for d in plan['days'] for a in d['activities'] for note in a['notes']))
    def test_asymmetric_two_opt_does_not_increase_objective(self):
        places=candidates(5);minutes=[[0,20,4,30,6],[2,0,18,3,22],[16,5,0,25,8],[7,14,3,0,15],[24,2,12,6,0]]
        matrix={'source':'test','estimated':False,'warnings':[],'minutes':minutes,'kilometers':[[v/2 for v in r] for r in minutes]}
        plain=self.engine(places,matrix).build(self.req(optimizer='greedy_insertion'))
        improved=self.engine(places,matrix).build(self.req(optimizer='greedy_2opt'))
        self.assertEqual({a['place_id'] for a in plain['days'][0]['activities']},{a['place_id'] for a in improved['days'][0]['activities']})
        self.assertLessEqual(travel_cost(improved['days'][0],self.req(),matrix,5),travel_cost(plain['days'][0],self.req(),matrix,5)+1e-9)
    def test_fixed_start_and_end_are_both_included(self):
        places=candidates(2);matrix={'source':'test','estimated':False,'warnings':[],'minutes':[[0,4,7,8],[5,0,9,10],[2,3,0,11],[12,13,14,0]],'kilometers':[[0 if i==j else 1 for j in range(4)] for i in range(4)]}
        req=self.req(start_location={'latitude':16,'longitude':108},end_location={'latitude':16.1,'longitude':108.1})
        day=self.engine(places,matrix).build(req)['days'][0]
        self.assertGreater(day['activities'][0]['travel_time_from_previous'],0);self.assertIsNotNone(day['return_leg'])
    def test_daily_budget_includes_break_and_wait(self):
        places=candidates(2,210);matrix={'source':'test','estimated':False,'warnings':[],'minutes':[[0,0],[0,0]],'kilometers':[[0,0],[0,0]]}
        day=self.engine(places,matrix).build(self.req(daily_window={'start':'08:00','end':'20:00'}))['days'][0]
        self.assertEqual(len(day['activities']),1);self.assertLessEqual(day['total_activity_minutes'],480)
    @patch('app.modules.trip_planner.ors_matrix.urlopen')
    def test_ors_order_units_and_unreachable_edges(self,open_url):
        data={'place_ids':['p',None],'coordinates':[[108,16],[109,17]],'durations':[[0,120],[None,0]],'distances':[[0,2500],[None,0]]}
        open_url.return_value=io.BytesIO(json.dumps(data).encode())
        with patch.dict('os.environ',{'TRIP_BACKEND_URL':'http://backend:3000'}):
            result=OrsMatrix().build([{'place_id':'p','latitude':16,'longitude':108},{'latitude':17,'longitude':109}],'driving')
        self.assertEqual(result['minutes'][0][1],2);self.assertEqual(result['kilometers'][0][1],2.5);self.assertIsNone(result['minutes'][1][0])


class PreviewAPITests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed
    def test_save_tool_needs_out_of_band_confirmation(self):
        from app.tools.tool_registry import ToolRegistry
        from app.core.exceptions import Conflict
        with self.assertRaises(Conflict):ToolRegistry(self.app.state.recommendation,'u').execute('save_trip',{'draft_id':'draft','name':'Test'})

    def test_vietnamese_replace_resolves_source_without_inventing_ids(self):
        from app.modules.trip_planner.requirement_extractor import RequirementExtractor
        result=RequirementExtractor(self.app.state.recommendation.store).extract('Đổi Bà Nà Hills sang Ngũ Hành Sơn.',{},False)
        self.assertEqual(result['fields']['remove_text'],'ba na hills')
        self.assertIn('ngu hanh son',result['fields']['replacement_query'])

    def test_date_clarification_keeps_semantic_need_when_llm_echoes_context(self):
        from app.modules.trip_planner.requirement_extractor import RequirementExtractor
        extractor=RequirementExtractor(self.app.state.recommendation.store)
        context={'city':'Đà Nẵng','days':3,'preferences':['biển','ẩm thực'],'query':'Muốn tham quan biển và thưởng thức ẩm thực'}
        with patch.object(extractor,'llm',return_value={'city':'Đà Nẵng','start_date':'2026-12-25','preferences':['biển','ẩm thực']}):
            extracted=extractor.extract('Khởi hành ngày 25/12/2026.',context,True)
        self.assertEqual(extracted['draft']['query'],context['query'])

    def test_chat_clarifies_then_creates_preview_and_replaces_exact_named_place(self):
        self.seed(fixtures.place('a',name='Bãi biển A'),fixtures.place('b',name='Bãi biển B'),fixtures.place('c',name='Cà phê C'))
        def routing(points,*_):
            n=len(points)
            return {'source':'ors','estimated':False,'warnings':[], 'minutes':[[0 if i==j else 5 for j in range(n)] for i in range(n)],
                    'kilometers':[[0 if i==j else 1 for j in range(n)] for i in range(n)]}
        body={'user_id':'u','preview_only':True,'intent':'trip_planning','message':'Lập lịch Đà Nẵng 1 ngày',
              'context':{'required_place_ids':['a','b'],'stops_per_day':2,'preferences':['biển'],
                         'party_size':2,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}}}
        first=self.client.post('/api/v1/chat',json=body)
        self.assertEqual(first.status_code,200,first.text);self.assertEqual(first.json()['status'],'needs_clarification')
        with patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',side_effect=routing):
            second=self.client.post('/api/v1/chat',json={**body,'conversation_id':first.json()['conversation_id'],'message':'Ngày đi là 2026-12-10'})
            self.assertEqual(second.status_code,200,second.text)
            self.assertEqual(second.json()['status'],'needs_clarification');self.assertIsNone(second.json()['trip'])
            confirmed=self.client.post('/api/v1/chat',json={**body,'conversation_id':first.json()['conversation_id'],'message':'xác nhận'})
            self.assertEqual(confirmed.status_code,200,confirmed.text);trip=confirmed.json()['trip']
            edited=self.client.post('/api/v1/chat',json={'user_id':'u','preview_only':True,'intent':'replanning',
                'conversation_id':first.json()['conversation_id'],'draft_id':trip['trip_id'],'expected_version':1,
                'message':'Ngày 1 bỏ Bãi biển A, thay bằng Cà phê C'})
        self.assertEqual(edited.status_code,200,edited.text)
        self.assertEqual({a['place_id'] for a in edited.json()['trip']['days'][0]['activities']},{'b','c'})


    def test_preview_does_not_save_trip_and_enforces_owner(self):
        self.seed(fixtures.place('p'))
        matrix={'source':'ors','estimated':False,'transport':'driving','warnings':[],'minutes':[[0]],'kilometers':[[0]]}
        with patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',return_value=matrix):
            response=self.client.post('/api/v1/trips/preview',json={'user_id':'u','city':'Đà Nẵng','start_date':'2026-12-10','days':1,'required_place_ids':['p']})
        self.assertEqual(response.status_code,200,response.text);draft=response.json()
        with self.app.state.recommendation.store.connection() as db:self.assertEqual(db.execute('SELECT count(*) FROM trips').fetchone()[0],0)
        self.assertEqual(self.client.get('/api/v1/trips/previews/'+draft['draft_id']+'?user_id=other').status_code,404)
        self.assertEqual(self.client.get('/api/v1/trips/previews/'+draft['draft_id']+'?user_id=u').status_code,200)
