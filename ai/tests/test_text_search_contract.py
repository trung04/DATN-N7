import os
import unittest
from unittest.mock import patch
from tests import test_recommendation as fixtures


class TextAPIContractTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_routes_are_registered_once_and_have_public_contracts(self):
        paths=['/api/v1/search/places','/api/v1/embeddings/text','/api/v1/embeddings/batch']
        spec=self.app.openapi()
        operation_ids=[]
        for path in paths:
            operation=spec['paths'][path]['post']
            operation_ids.append(operation['operationId'])
            self.assertIn('200',operation['responses'])
            self.assertIn('requestBody',operation)
        self.assertEqual(len(set(operation_ids)),len(paths))
        self.assertFalse(any('/api/v1/api/v1/' in path for path in spec['paths']))

    def test_text_embedding_response_and_batch_order(self):
        response=self.client.post('/api/v1/embeddings/text',json={'text':'biển'})
        self.assertEqual(response.status_code,200,response.text)
        data=response.json();self.assertEqual(data['dimensions'],len(data['embedding']))
        inputs=['biển','núi']
        response=self.client.post('/api/v1/embeddings/batch',json={'text':inputs})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['embeddings'],self.embedding.embed_batch(inputs))
        self.assertEqual(self.client.post('/api/v1/embeddings/batch',json={'text':['a']*101}).status_code,400)

    def test_search_page_schema_empty_query_and_service_key(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        response=self.client.post('/api/v1/search/places',json={'query':'biển','infer_filters':False,'limit':1})
        self.assertEqual(response.status_code,200,response.text)
        data=response.json();self.assertEqual(data['total'],2);self.assertEqual(len(data['results']),1)
        self.assertEqual(data['retrieval'],'local_exact_bge_bm25_rrf')
        second=self.client.post('/api/v1/search/places',json={'query':'biển','infer_filters':False,'limit':1,'offset':1}).json()
        self.assertNotEqual(second['results'][0]['place_id'],data['results'][0]['place_id'])
        for query in [' ','!!!']:
            self.assertEqual(self.client.post('/api/v1/search/places',json={'query':query}).status_code,422)
        with patch.dict(os.environ,{'RECOMMENDATION_API_KEY':'test-only'}):
            for path,body in [('/api/v1/search/places',{'query':'biển'}),('/api/v1/embeddings/text',{'text':'a'}),('/api/v1/embeddings/batch',{'text':['a']})]:
                self.assertEqual(self.client.post(path,json=body).status_code,401)
                self.assertEqual(self.client.post(path,json=body,headers={'X-API-Key':'test-only'}).status_code,200)

    def test_sorting_by_name_and_rating_happens_before_pagination(self):
        self.seed(
            fixtures.place("a", name="Địa điểm Z", rating=3),
            fixtures.place("b", name="Địa điểm A", rating=4),
            fixtures.place("c", name="Địa điểm M", rating=5),
        )
        for sort_by, sort_order, expected_ids in [
            ("name", "asc", ["b", "c", "a"]),
            ("rating", "desc", ["c", "b", "a"]),
        ]:
            ids = []
            for offset in range(3):
                response = self.client.post("/api/v1/search/places", json={
                    "query": "biển",
                    "sort_by": sort_by,
                    "sort_order": sort_order,
                    "limit": 1,
                    "offset": offset,
                })
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["total"], 3)
                ids.append(response.json()["results"][0]["place_id"])
            self.assertEqual(ids, expected_ids)
