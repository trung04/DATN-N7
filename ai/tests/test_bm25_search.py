from unittest.mock import patch
import unittest
from tests import test_recommendation as fixtures
from app.modules.semantic_search.text_search import bm25


class BM25SearchTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed
    def test_bm25_does_not_call_embedding_and_returns_keyword_order(self):
        self.seed(fixtures.place('a',name='Spa',tags=[],description='spa spa spa'),
                  fixtures.place('b',name='Bãi biển',tags=[],description='cát trắng'))
        with patch.object(self.embedding,'embed_text',side_effect=AssertionError('BM25 must not embed')):
            result=self.client.post('/api/v1/search/places',json={'query':'spa','method':'bm25','infer_filters':False})
        self.assertEqual(result.status_code,200,result.text)
        data=result.json();self.assertEqual(data['retrieval'],'bm25')
        self.assertEqual([p['place_id'] for p in data['results']],['a'])
        self.assertIsNone(data['results'][0]['semantic_score'])
        self.assertGreater(data['results'][0]['score'],0)
        self.assertEqual(self.client.post('/api/v1/search/places',json={'query':'spa','method':'bm25','min_similarity':.5}).status_code,422)

    def test_methods_share_filters_and_corpus(self):
        self.seed(fixtures.place('a'),fixtures.place('b',city='Huế'))
        for method in ('bm25','bge','hybrid'):
            data=self.client.post('/api/v1/search/places',json={'query':'biển','method':method,'infer_filters':False,'filters':{'city':'Đà Nẵng'}}).json()
            self.assertEqual([p['place_id'] for p in data['results']],['a'])

    def test_bm25_term_frequency_length_and_empty(self):
        scores=bm25('spa',['spa spa','spa '+('other '*100),'nothing'])
        self.assertGreater(scores[0],scores[1]);self.assertEqual(scores[2],0)
        self.assertEqual(bm25('spa',[]),[])
