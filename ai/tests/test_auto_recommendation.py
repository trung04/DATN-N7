import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from tests import test_recommendation as fixtures
from app.database.sqlite import Store


class AutoRecommendationTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def recommend(self,**extra):
        response=self.client.post('/api/v1/recommendations',json={'user_id':'u','refresh_variety':False,**extra})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def event(self,**extra):
        body={'event_id':'event-1','place_id':'a','action':'view','occurred_at':datetime.now(timezone.utc).isoformat(),**extra}
        response=self.client.post('/api/v1/users/u/interactions',json=body)
        self.assertEqual(response.status_code,200,response.text)
        return body

    def test_cold_start_preferences_and_impressions_are_not_history(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.client.put('/api/v1/users/u/preferences',json={'preferences':['biển']})
        for _ in range(2):
            result=self.recommend()
            self.assertEqual(result['strategy'],'content_rating')
            self.assertEqual(result['diagnostics']['requested_mode'],'auto')
            self.assertEqual(result['diagnostics']['selection_reason'],'no_history')
            self.assertIsNone(result['recommendations'][0]['mmr_score'])
        self.assertEqual(self.client.get('/api/v1/users/u/interactions').json()['total'],0)

    def test_first_event_switches_next_request_and_is_user_scoped(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.assertEqual(self.recommend()['strategy'],'rating_fallback')
        body=self.event(action='save',active=True)
        self.client.post('/api/v1/users/u/interactions',json=body)
        with patch.object(self.embedding,'embed_text',side_effect=AssertionError('Use stored place vectors')):
            result=self.recommend()
        self.assertEqual(result['strategy'],'personalized_mmr')
        self.assertEqual(result['diagnostics']['history_event_count'],1)
        self.assertTrue(result['diagnostics']['history_available'])
        self.assertEqual(result['diagnostics']['selection_reason'],'history_present')
        self.assertIsNotNone(result['recommendations'][0]['mmr_score'])
        self.assertEqual(self.recommend(user_id='other')['strategy'],'rating_fallback')
        self.assertEqual(self.recommend(mode='content_rating')['strategy'],'rating_fallback')
        persisted=Store(self.app.state.recommendation.store.path)
        self.assertEqual(len(persisted.interactions('u')),1)

    def test_negative_only_history_excludes_and_clear_returns_to_baseline(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.event(action='rating',rating=1)
        result=self.recommend()
        self.assertEqual(result['strategy'],'rating_mmr_fallback')
        self.assertEqual([r['place_id'] for r in result['recommendations']],['b'])
        self.assertFalse(result['diagnostics']['history_available'])
        self.assertEqual(self.client.delete('/api/v1/users/u/interactions').status_code,200)
        self.assertEqual(self.recommend()['diagnostics']['mode'],'content_rating')

    def test_stale_vectors_fall_back_without_claiming_history_profile(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.event()
        with self.app.state.recommendation.store.connection() as db:
            db.execute("UPDATE places SET model='old' WHERE id='a'")
        result=self.recommend(preferences=['biển'])
        self.assertEqual(result['diagnostics']['mode'],'personalized_mmr')
        self.assertFalse(result['diagnostics']['history_available'])
        self.assertTrue(result['warnings'])
