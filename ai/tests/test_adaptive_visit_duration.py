import copy
import json
import unittest
from types import SimpleNamespace
from app.modules.trip_planner.schemas import TripRequest
from app.modules.trip_planner.visit_duration import prepare_durations,distribute_spare_time
from app.modules.trip_planner.schedule_validator import schedule_route
from app.modules.trip_planner.input_gate import check_inputs
from app.modules.recommendation.schemas import PlaceData
from tests.test_recommendation import place
from tests import test_recommendation as fixtures
from unittest.mock import patch


class AdaptiveDurationTests(unittest.TestCase):
    def request(self,**kwargs):
        return TripRequest(user_id='u',city='Đà Nẵng',days=1,start_date='2099-12-01',fill_day=True,
            visit_duration_mode='adaptive',**kwargs)

    def candidates(self,closing='09:00-18:00'):
        return [{'place':PlaceData.model_validate(place(str(i),duration_minutes=60,opening_hours=closing)).model_dump(mode='json'),
                 'score':score,'semantic_score':score,'required':True} for i,score in enumerate([1,.5,0])]

    def matrix(self):
        return {'source':'test','estimated':False,'warnings':[],
            'minutes':[[0 if i==j else 10 for j in range(3)] for i in range(3)],
            'kilometers':[[0 if i==j else 1 for j in range(3)] for i in range(3)]}

    def test_weighted_minutes_use_window_and_preserve_catalog(self):
        req=self.request();cs=self.candidates();original=copy.deepcopy(cs)
        prepare_durations(req,cs)
        self.assertGreater(cs[0]['visit_minutes'],cs[2]['visit_minutes'])
        day=distribute_spare_time([0,1,2],1,req,cs,self.matrix(),None,schedule_route)
        self.assertEqual(day['end_time'][11:16],'18:00')
        self.assertEqual(day['total_activity_minutes'],480)
        self.assertGreater(day['activities'][0]['duration_minutes'],day['activities'][2]['duration_minutes'])
        self.assertEqual([c['place']['duration_minutes'] for c in cs],[60]*3)
        self.assertEqual(original[0]['place'],cs[0]['place'])

    def test_explicit_minutes_and_opening_limits_win(self):
        req=self.request(duration_overrides={'0':75});cs=prepare_durations(req,self.candidates('09:00-14:00'))
        day=distribute_spare_time([0,1,2],1,req,cs,self.matrix(),None,schedule_route)
        self.assertIsNotNone(day)
        self.assertEqual(day['activities'][0]['duration_minutes'],75)
        self.assertLessEqual(day['end_time'][11:16],'14:00')

    def test_focus_uses_embedding_instead_of_rating(self):
        req=self.request(duration_focus=['biển']);cs=self.candidates()[:2]
        rows=[{'id':'0','vector':json.dumps([1,0])},{'id':'1','vector':json.dumps([0,1])}]
        rec=SimpleNamespace(content=SimpleNamespace(embedding=SimpleNamespace(embed_text=lambda text:[0,1])),
                            store=SimpleNamespace(places=lambda:rows))
        prepare_durations(req,cs,rec)
        self.assertGreater(cs[1]['visit_minutes'],cs[0]['visit_minutes'])
        self.assertEqual(cs[1]['duration_source'],'focus_estimate')

    def test_optional_question_once_and_skip_uses_similarity(self):
        draft={'city':'Đà Nẵng','start_date':'2099-12-01','days':1,'preferences':['biển','ẩm thực'],
               'party_size':2,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}}
        conv={};self.assertIn('nhiều thời gian',check_inputs('lập lịch',draft,conv))
        self.assertEqual(conv['pending_fields'],['duration_focus'])
        self.assertIsNone(check_inputs('tự phân bổ',draft,conv))
        self.assertEqual(draft['duration_focus'],[])
        self.assertEqual(draft['visit_duration_mode'],'adaptive')


class FocusConversationTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_focus_answer_keeps_preferences_and_creates_one_preview(self):
        self.seed(*(place(str(i),duration_minutes=60,opening_hours='09:00-18:00') for i in range(8)))
        context={'city':'Đà Nẵng','start_date':'2099-12-01','days':1,'preferences':['biển','ẩm thực'],
                 'party_size':2,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}}
        first=self.client.post('/api/v1/chat',json={'user_id':'u','message':'Lập lịch','preview_only':True,'context':context}).json()
        self.assertEqual(first['status'],'needs_clarification')
        self.assertIn('nhiều thời gian',first['message'])
        def matrix(points,*args):
            n=len(points);return {'source':'ors','estimated':False,'warnings':[],
                'minutes':[[0 if i==j else 5 for j in range(n)] for i in range(n)],
                'kilometers':[[0 if i==j else 1 for j in range(n)] for i in range(n)]}
        with patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',side_effect=matrix):
            second=self.client.post('/api/v1/chat',json={'user_id':'u','conversation_id':first['conversation_id'],
                'message':'ẩm thực','preview_only':True}).json()
        self.assertEqual(second['status'],'preview_created',second)
        self.assertEqual(second['extraction']['draft']['duration_focus'],['ẩm thực'])
        self.assertEqual(second['extraction']['draft']['preferences'],['biển','ẩm thực'])
        self.assertTrue(all(a['duration_source']=='focus_estimate' for d in second['trip']['days'] for a in d['activities']))
