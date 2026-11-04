import unittest
from datetime import datetime,timezone
import test_recommendation as fixtures
from app.tools.tool_registry import ToolRegistry
from app.llm.tool_definitions import function_declarations
from app.core.exceptions import Conflict
from app.modules.recommendation.training import fit_item_knn,TrainedItemKNN

class ToolTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_whitelist_and_identity(self):
        registry=ToolRegistry(self.client.app.state.recommendation,'u')
        with self.assertRaises(ValueError):registry.execute_call({'name':'run_shell','args':{'cmd':'whoami'}})
        with self.assertRaises(Conflict):registry.execute('recommend',{'request':{'user_id':'other'}})
        self.assertTrue(any(d['name']=='optimize_trip' for d in function_declarations()))

    def test_validated_details(self):
        self.seed(fixtures.place('a'))
        registry=ToolRegistry(self.client.app.state.recommendation,'u')
        self.assertEqual(registry.execute_call({'name':'place_details','args':{'place_id':'a'}})['place_id'],'a')

class TrainingTests(unittest.TestCase):
    def test_snapshot_training_and_prediction(self):
        events=[]
        for uid in ('u','v','w'):
            for pid in ('a','b'):
                events.append({'event_id':uid+pid,'user_id':uid,'place_id':pid,'interaction_type':'favorite','occurred_at':'2026-01-01T00:00:00+00:00'})
        model=TrainedItemKNN(fit_item_knn(events,datetime(2026,2,1,tzinfo=timezone.utc)))
        self.assertGreater(model.score({('new','a'):1},'new')['b'],0)
        self.assertEqual(model.score({},'new'),{})

    def test_future_training_data_rejected(self):
        events=[{'occurred_at':'2026-02-02T00:00:00+00:00'}]
        with self.assertRaises(ValueError):fit_item_knn(events,datetime(2026,2,1,tzinfo=timezone.utc))
