import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch
from tests import test_recommendation as fixtures
from app.modules.trip_planner.standalone_ors import StandaloneOrs


class DirectOrsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.env=patch.dict(os.environ,{'ORS_API_KEY':'fake-only','TRIP_ORS_MODE':'direct','TRIP_ORS_CACHE_PATH':self.temp.name+'/cache.sqlite','ORS_MIN_INTERVAL_MS':'0'});self.env.start()
    def tearDown(self):self.env.stop();self.temp.cleanup()
    @patch('app.modules.trip_planner.standalone_ors.urlopen')
    def test_directed_cache_units_and_missing_edges(self,open_url):
        open_url.return_value=io.BytesIO(json.dumps({'durations':[[0,120],[None,0]],'distances':[[0,2500],[None,0]]}).encode())
        points=[{'latitude':16,'longitude':108},{'latitude':16.1,'longitude':108.1}]
        first=StandaloneOrs().build(points,'driving');second=StandaloneOrs().build(points,'driving')
        self.assertEqual(open_url.call_count,1);self.assertEqual(first['minutes'][0][1],2);self.assertEqual(first['kilometers'][0][1],2.5)
        self.assertIsNone(first['minutes'][1][0]);self.assertEqual(second['cached_pairs'],2);self.assertFalse(second['estimated'])
        request=open_url.call_args.args[0];self.assertEqual(request.full_url,'https://api.heigit.org/openrouteservice/v2/matrix/driving-car')
    @patch('app.modules.trip_planner.standalone_ors.urlopen')
    def test_invalid_matrix_is_not_cached_or_fabricated(self,open_url):
        open_url.return_value=io.BytesIO(b'{"durations":[],"distances":[]}')
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as error:StandaloneOrs().build([{'latitude':16,'longitude':108},{'latitude':17,'longitude':109}],'driving')
        self.assertEqual(error.exception.status_code,502)
    @patch('app.modules.trip_planner.standalone_ors.time.sleep')
    @patch('app.modules.trip_planner.standalone_ors.urlopen')
    def test_provider_failure_has_bounded_retries_and_no_estimate(self,open_url,sleep):
        from urllib.error import URLError
        from fastapi import HTTPException
        open_url.side_effect=URLError('offline')
        with self.assertRaises(HTTPException) as error:StandaloneOrs().build([{'latitude':16,'longitude':108},{'latitude':17,'longitude':109}],'driving')
        self.assertEqual(error.exception.status_code,503);self.assertEqual(open_url.call_count,3)


class DemoSavedTripTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed
    def preview(self):
        self.seed(fixtures.place('a',name='Bãi biển A'),fixtures.place('b',name='Bãi biển B'))
        matrix={'source':'ors','estimated':False,'warnings':[],'minutes':[[0,5],[6,0]],'kilometers':[[0,1],[2,0]]}
        with patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',return_value=matrix):
            response=self.client.post('/api/v1/trips/preview',json={'user_id':'u','city':'Đà Nẵng','start_date':'2026-12-25','days':1,'required_place_ids':['a','b']})
        self.assertEqual(response.status_code,200,response.text);return response.json()
    def test_explicit_demo_save_idempotency_owner_restore_and_delete(self):
        draft=self.preview()
        self.assertEqual(self.client.get('/api/v1/demo/trips?user_id=u').json()['items'],[])
        payload={'user_id':'u','draft_id':draft['draft_id'],'expected_draft_version':1,'name':'Chuyến đi kiểm thử'}
        first=self.client.post('/api/v1/demo/trips',json=payload);self.assertEqual(first.status_code,201,first.text);saved=first.json()
        self.assertEqual(self.client.post('/api/v1/demo/trips',json=payload).json()['id'],saved['id'])
        self.assertEqual(self.client.get('/api/v1/demo/trips/'+saved['id']+'?user_id=other').status_code,404)
        restored=self.client.post('/api/v1/demo/trips/'+saved['id']+'/preview',json={'user_id':'u','expected_version':1})
        self.assertEqual(restored.status_code,200,restored.text);self.assertTrue(restored.json()['result']['preview_only']);self.assertFalse(restored.json()['result']['saved'])
        self.assertEqual(self.client.delete('/api/v1/demo/trips/'+saved['id']+'?user_id=u&expected_version=99').status_code,409)
        self.assertEqual(self.client.delete('/api/v1/demo/trips/'+saved['id']+'?user_id=u&expected_version=1').status_code,204)
    def test_stale_preview_cannot_be_saved(self):
        draft=self.preview()
        response=self.client.post('/api/v1/demo/trips',json={'user_id':'u','draft_id':draft['draft_id'],'expected_draft_version':99,'name':'Stale'})
        self.assertEqual(response.status_code,409)
    def test_chat_adds_real_named_place_and_only_changes_that_day_target(self):
        self.seed(fixtures.place('a',name='Bãi biển A'),fixtures.place('b',name='Cà phê B'),fixtures.place('c',name='Cà phê C'))
        def matrix(points,*_):
            n=len(points);return {'source':'ors','estimated':False,'warnings':[],'minutes':[[0 if i==j else 5 for j in range(n)] for i in range(n)],'kilometers':[[0 if i==j else 1 for j in range(n)] for i in range(n)]}
        with patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',side_effect=matrix):
            created=self.client.post('/api/v1/trips/preview',json={'user_id':'u','city':'Đà Nẵng','start_date':'2026-12-25','days':1,'required_place_ids':['a'],'stops_per_day':1})
            self.assertEqual(created.status_code,200,created.text);draft=created.json()
            changed=self.client.post('/api/v1/chat',json={'user_id':'u','preview_only':True,'draft_id':draft['draft_id'],'expected_version':1,'message':'Ngày 1 thêm Cà phê C'})
        self.assertEqual(changed.status_code,200,changed.text)
        self.assertEqual({a['place_id'] for a in changed.json()['trip']['days'][0]['activities']},{'a','c'})
        stored=self.client.get('/api/v1/trips/previews/'+draft['draft_id']+'?user_id=u').json()
        self.assertEqual(stored['request']['day_stop_limits'],{'1':2})
