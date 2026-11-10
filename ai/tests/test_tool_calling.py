import unittest
import test_recommendation as fixtures
from app.tools.tool_registry import ToolRegistry
from app.core.exceptions import Conflict

class ToolTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_whitelist_and_identity(self):
        registry=ToolRegistry(self.client.app.state.recommendation,'u')
        with self.assertRaises(ValueError):registry.execute_call({'name':'run_shell','args':{'cmd':'whoami'}})
        with self.assertRaises(Conflict):registry.execute('recommend',{'request':{'user_id':'other'}})

    def test_validated_details(self):
        self.seed(fixtures.place('a'))
        registry=ToolRegistry(self.client.app.state.recommendation,'u')
        self.assertEqual(registry.execute_call({'name':'place_details','args':{'place_id':'a'}})['place_id'],'a')
