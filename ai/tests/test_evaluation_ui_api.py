import unittest
from unittest.mock import patch
import os
from tests import test_recommendation as fixtures


class EvaluationAPITests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def run_query(self):
        self.seed(fixtures.place('a'),fixtures.place('b'),fixtures.place('c'),fixtures.place('other',city='Huế'))
        response=self.client.post('/api/v1/search-evaluations',json={'query':'biển','city':'Đà Nẵng','k':2})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_partial_and_complete_scope_metrics_and_persistence(self):
        d=self.run_query();self.assertEqual(len(d['corpus']),3);self.assertEqual(len(d['ranking']),2)
        base='/api/v1/search-evaluations/'+d['id']
        self.assertEqual(self.client.get(base+'/metrics').status_code,422)
        ids=[p['place_id'] for p in d['ranking']]
        labels={ids[0]:3,ids[1]:0}
        response=self.client.patch(base+'/labels',json={'expected_version':1,'labels':labels})
        self.assertEqual(response.status_code,200,response.text)
        partial=self.client.get(base+'/metrics').json()
        self.assertFalse(partial['complete_scope']);self.assertTrue(partial['warning'])
        self.assertEqual(partial['metrics']['2']['recall'],1)
        missing=next(p['place_id'] for p in d['corpus'] if p['place_id'] not in ids)
        self.client.patch(base+'/labels',json={'expected_version':2,'labels':{missing:3}})
        full=self.client.get(base+'/metrics').json()
        self.assertTrue(full['complete_scope']);self.assertIsNone(full['warning'])
        self.assertEqual(full['metrics']['2']['recall'],.5)
        self.assertEqual(self.client.get(base).json()['labels'][missing],3)
        self.assertEqual(self.client.get('/api/v1/search-evaluations').json()['items'][0]['labeled'],3)
        aggregate=self.client.get('/api/v1/search-evaluations/reports/aggregate').json()
        self.assertEqual(aggregate['complete_queries'],1)
        self.assertEqual(aggregate['metrics']['2']['recall'],.5)
        self.assertGreaterEqual(full['latency_ms'],0)
        self.assertIsNone(full['resources']['vram_allocated_mib'])

    def test_validation_conflict_auth_and_unknown_id(self):
        d=self.run_query();base='/api/v1/search-evaluations/'+d['id']
        for labels in [{'unknown':2},{'a':4},{'a':True}]:
            self.assertEqual(self.client.patch(base+'/labels',json={'expected_version':1,'labels':labels}).status_code,422)
        self.client.patch(base+'/labels',json={'expected_version':1,'labels':{'a':2}})
        self.assertEqual(self.client.patch(base+'/labels',json={'expected_version':1,'labels':{'a':3}}).status_code,409)
        self.client.patch(base+'/labels',json={'expected_version':2,'labels':{'a':None}})
        self.assertNotIn('a',self.client.get(base).json()['labels'])
        self.assertEqual(self.client.get('/api/v1/search-evaluations/missing').status_code,404)
        with patch.dict(os.environ,{'RECOMMENDATION_API_KEY':'evaluation-test-only'}):
            self.assertEqual(self.client.get(base).status_code,401)

    def test_frozen_corpus_does_not_change_when_place_changes(self):
        d=self.run_query();old=next(p['name'] for p in d['corpus'] if p['place_id']=='a')
        self.seed(fixtures.place('a',name='Changed after run'))
        saved=self.client.get('/api/v1/search-evaluations/'+d['id']).json()
        self.assertEqual(next(p['name'] for p in saved['corpus'] if p['place_id']=='a'),old)
        self.assertEqual(self.client.get('/evaluation').status_code,200)
        self.assertEqual(self.client.get('/demo-assets/evaluation.js').status_code,200)
