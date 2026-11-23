import unittest
from datetime import datetime, timedelta, timezone
import numpy as np
from tests import test_recommendation as fixtures
from app.modules.recommendation.personalized import aggregate_signals, rerank_mmr


class PersonalizedTests(unittest.TestCase):
    setUp = fixtures.APITests.setUp
    tearDown = fixtures.APITests.tearDown
    seed = fixtures.APITests.seed
    recommend = fixtures.APITests.recommend

    def event(self, pid, action="view", **extra):
        body = {"event_id": str(__import__('uuid').uuid4()), "place_id": pid, "action": action,
                "occurred_at": datetime.now(timezone.utc).isoformat(), **extra}
        return body, self.client.post('/api/v1/users/u/interactions', json=body)

    def test_idempotency_conflict_validation_and_missing_place(self):
        self.seed(fixtures.place('a'))
        body, response = self.event('a'); self.assertTrue(response.json()['created'])
        self.assertFalse(self.client.post('/api/v1/users/u/interactions',json=body).json()['created'])
        self.assertEqual(self.client.post('/api/v1/users/v/interactions',json=body).status_code,409)
        self.assertEqual(self.event('missing')[1].status_code,404)
        self.assertEqual(self.event('a','rating')[1].status_code,422)
        self.assertEqual(self.event('a','favorite')[1].status_code,422)
        self.assertEqual(self.event('a',occurred_at=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat())[1].status_code,422)

    def test_history_updates_without_reembedding_and_is_user_scoped(self):
        self.seed(fixtures.place('sea',description='biển '*30), fixtures.place('mountain',description='núi '*30))
        calls=self.embedding.calls
        self.event('sea','save',active=True)
        result=self.recommend(mode='personalized_mmr',preferences=[],mmr_lambda=1)
        self.assertEqual(result['recommendations'][0]['place_id'],'sea')
        self.assertEqual(result['diagnostics']['history_places_used'],1)
        self.assertEqual(self.embedding.calls,calls)
        other=self.client.post('/api/v1/recommendations',json={'user_id':'other','mode':'personalized_mmr'}).json()
        self.assertFalse(other['diagnostics']['history_available'])
        self.assertEqual(self.recommend(preferences=[])['strategy'],'rating_fallback')

    def test_negative_rating_excludes_and_latest_rating_restores(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.event('a','save',active=True);self.event('a','rating',rating=1)
        result=self.recommend(mode='personalized_mmr')
        self.assertNotIn('a',[i['place_id'] for i in result['recommendations']])
        self.event('a','rating',rating=5)
        self.assertIn('a',[i['place_id'] for i in self.recommend(mode='personalized_mmr')['recommendations']])
        self.assertGreater(self.client.delete('/api/v1/users/u/interactions').json()['deleted'],0)
        self.assertFalse(self.recommend(mode='personalized_mmr')['diagnostics']['history_available'])

    def test_cold_start_and_constraints(self):
        self.seed(fixtures.place('a'),fixtures.place('b',city='Huế'))
        result=self.recommend(mode='personalized_mmr',preferences=['biển'],city='Đà Nẵng')
        self.assertFalse(result['diagnostics']['history_available'])
        self.assertEqual([i['place_id'] for i in result['recommendations']],['a'])
        for extra in [{'mmr_lambda':1.1},{'preference_alpha':-1},{'mmr_pool_size':1,'limit':2}]:
            self.assertEqual(self.client.post('/api/v1/recommendations',json={'user_id':'u','mode':'personalized_mmr',**extra}).status_code,422)

    def test_alpha_endpoints_and_out_of_order_delivery(self):
        self.seed(fixtures.place('sea',description='biển '*30),fixtures.place('mountain',description='núi '*30))
        self.event('sea','save',active=True)
        self.assertEqual(self.recommend(mode='personalized_mmr',preferences=['núi'],preference_alpha=0,mmr_lambda=1)['recommendations'][0]['place_id'],'sea')
        self.assertEqual(self.recommend(mode='personalized_mmr',preferences=['núi'],preference_alpha=1,mmr_lambda=1)['recommendations'][0]['place_id'],'mountain')
        self.event('sea','save',active=False)
        self.event('sea','save',active=True,occurred_at=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat())
        self.assertFalse(self.recommend(mode='personalized_mmr')['diagnostics']['history_available'])

    def test_stale_history_vector_is_ignored(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        self.event('a','save',active=True)
        with self.app.state.recommendation.store.connection() as db:
            db.execute("UPDATE places SET model='stale' WHERE id='a'")
        result=self.recommend(mode='personalized_mmr',preferences=[])
        self.assertFalse(result['diagnostics']['history_available'])
        self.assertEqual(result['diagnostics']['history_places_without_vector'],1)

    def test_visible_history_and_demo_profile_list(self):
        self.seed(fixtures.place('a'))
        body,_=self.event('a','favorite',active=True)
        history=self.client.get('/api/v1/users/u/interactions').json()
        self.assertEqual(history['total'],1)
        self.assertEqual(history['items'][0]['place_name'],fixtures.place('a')['name'])
        self.assertEqual(history['positive_place_weights'],{'a':3.})
        self.assertEqual(self.client.get('/api/v1/users/other/interactions').json()['total'],0)
        self.client.put('/api/v1/users/demo-beach-test/preferences',json={'preferences':[]})
        body['event_id']='demo-event'
        self.client.post('/api/v1/users/demo-beach-test/interactions',json=body)
        demos=self.client.get('/api/v1/recommendation/demo-users').json()['items']
        self.assertEqual(demos,[{'user_id':'demo-beach-test','event_count':1}])
        self.assertEqual(self.client.get('/api/v1/users/u/interactions?limit=0').status_code,422)

    def test_aggregation_caps_views_and_removes_state(self):
        events=[{'place_id':'a','action':'view'} for _ in range(100)]
        events += [{'place_id':'a','action':'favorite','active':True}, {'place_id':'a','action':'favorite','active':False},
                   {'place_id':'a','action':'rating','rating':3}]
        self.assertEqual(aggregate_signals(events),({'a':2.},set()))

    def test_mmr_diversifies_and_lambda_one_preserves_relevance(self):
        items=[{'place_id':p,'score':s} for p,s in [('a',1.),('b',.99),('c',.9)]]
        vectors={'a':np.array([1.,0.]),'b':np.array([1.,0.]),'c':np.array([0.,1.])}
        self.assertEqual([x['place_id'] for x in rerank_mmr(items,vectors,2,.3)],['a','c'])
        self.assertEqual([x['place_id'] for x in rerank_mmr(items,vectors,2,1)],['a','b'])

    def test_refresh_changes_membership_preserves_anchors_and_can_be_disabled(self):
        self.seed(*(fixtures.place(str(i)) for i in range(12)))
        args={'mode':'personalized_mmr','preferences':['biển'],'limit':5,'mmr_lambda':1}
        first=self.recommend(**args)
        second=self.recommend(**args)
        ids=lambda r:[i['place_id'] for i in r['recommendations']]
        self.assertEqual(ids(first)[:3],ids(second)[:3])
        self.assertGreaterEqual(len(set(ids(second))-set(ids(first))),2)
        self.assertEqual(second['diagnostics']['fresh_count'],2)
        stable1=self.recommend(**args,refresh_variety=False)
        stable2=self.recommend(**args,refresh_variety=False)
        self.assertEqual(ids(stable1),ids(stable2))
        other=self.client.post('/api/v1/recommendations',json={'user_id':'other',**args}).json()
        self.assertEqual(ids(first),ids(other))

    def test_refresh_exhaustion_reports_limit_and_does_not_duplicate_items(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        args={'mode':'personalized_mmr','preferences':['biển'],'limit':2}
        self.recommend(**args)
        result=self.recommend(**args)
        self.assertEqual(result['diagnostics']['fresh_count'],0)
        self.assertTrue(result['warnings'])
        self.assertEqual(len({i['place_id'] for i in result['recommendations']}),2)
