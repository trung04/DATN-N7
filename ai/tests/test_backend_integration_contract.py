import os
from unittest.mock import patch
from tests import test_recommendation as fixtures


class BackendIntegrationContractTests(fixtures.unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_frontend_recommendation_contract_uses_real_ranker(self):
        self.seed(fixtures.place('beach',description='Quiet beach'))
        response=self.client.post('/api/v1/ai/recommendations',json={'query':'biển','limit':1})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()[0]['id'],'beach')
        self.assertEqual(response.json()[0]['type'],'destination')
        self.assertIsNone(response.json()[0]['price'])
        detailed=self.client.post('/api/v1/ai/recommendations/detailed',json={'query':'biển','userId':'real-backend-user','limit':1})
        self.assertEqual(detailed.status_code,200,detailed.text)
        self.assertEqual(detailed.json()['user_id'],'real-backend-user')

    def test_semantic_search_adapter_matches_native_contract(self):
        self.seed(fixtures.place('beach'))
        body={'query':'biển','filters':{'city':'Đà Nẵng'},'infer_filters':False,'limit':1}
        response=self.client.post('/api/v1/ai/search',json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['results'][0]['place_id'],'beach')

    def test_chat_adapter_asks_for_date_and_never_auto_saves(self):
        response=self.client.post('/api/v1/ai/chat',json={'userId':'backend-user','message':'Lập lịch Đà Nẵng 3 ngày','useLlm':False})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['status'],'needs_clarification')
        self.assertTrue(response.json()['preview_only'])
        with self.app.state.recommendation.store.connection() as db:
            exists=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='trips'").fetchone()
            self.assertEqual(db.execute('SELECT count(*) FROM trips').fetchone()[0] if exists else 0,0)

    def test_service_auth_and_validation_cannot_be_skipped(self):
        with patch.dict(os.environ,{'RECOMMENDATION_API_KEY':'integration-test-secret'}):
            self.assertEqual(self.client.post('/api/v1/ai/recommendations',json={'query':'beach'}).status_code,401)
            response=self.client.post('/api/v1/ai/recommendations',headers={'X-API-Key':'integration-test-secret'},json={'limit':101})
            self.assertEqual(response.status_code,422)
        self.assertEqual(self.client.post('/api/v1/ai/chat',json={'userId':'u','message':'test','previewOnly':False}).status_code,422)
