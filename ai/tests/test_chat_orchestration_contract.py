import json
import unittest
from pathlib import Path
from unittest.mock import patch
from app.agents.chat_understanding import Understanding, understand, ORCHESTRATION_SYSTEM
from tests import test_chat_acceptance_30 as acceptance


class OrchestrationContractTests(unittest.TestCase):
    def test_suite_partition_is_complete_and_disjoint(self):
        cases=json.loads((Path(__file__).resolve().parent/'fixtures/chat_orchestration_cases.json').read_text(encoding='utf-8'))
        self.assertEqual({c['id'] for c in cases},{f'TC{i}' for i in range(31,86)})
        self.assertEqual(len(cases),55)
        self.assertEqual(sum(c['split']=='holdout' for c in cases),13)

    def test_prompt_context_is_bounded_and_has_local_date(self):
        with patch('app.agents.chat_understanding.GeminiClient.generate',return_value=Understanding(intent='general_chat')) as generate:
            understand('test',{'draft':{'city':'example','secret':'never'},'messages':[{'role':'user','text':'x'*1000}]*30},False)
        system,payload,_=generate.call_args.args
        body=json.loads(payload)
        self.assertEqual(system,ORCHESTRATION_SYSTEM)
        self.assertEqual(len(body['recent_messages']),6)
        self.assertTrue(all(len(m['text'])<=350 for m in body['recent_messages']))
        self.assertNotIn('secret',body['requirements'])
        self.assertEqual(body['timezone'],'Asia/Ho_Chi_Minh')
        self.assertRegex(body['current_date'],r'^\d{4}-\d{2}-\d{2}$')


class ClarificationWorkflowTests(unittest.TestCase):
    setUp=acceptance.ChatAcceptance30.setUp
    tearDown=acceptance.ChatAcceptance30.tearDown
    seed=acceptance.ChatAcceptance30.seed

    def test_negative_interest_filters_catalog_candidates(self):
        from app.modules.trip_planner.candidate_generator import CandidateGenerator
        from app.modules.trip_planner.schemas import TripRequest
        from tests.test_recommendation import place
        self.seed(place('beach',name='Beach',tags=['biển']),place('mountain',name='Mountain',tags=['núi']))
        request=TripRequest(user_id='u',city='Đà Nẵng',days=1,start_date='2026-12-01',excluded_preferences=['biển'])
        candidates=CandidateGenerator(self.app.state.recommendation).generate(request)
        self.assertEqual([p['place']['place_id'] for p in candidates],['mountain'])
        with self.assertRaises(ValueError):
            CandidateGenerator(self.app.state.recommendation).generate(request.model_copy(update={'required_place_ids':['beach']}))

    def test_ungrounded_month_and_year_are_not_accepted_from_llm(self):
        from app.modules.trip_planner.requirement_extractor import RequirementExtractor
        extracted=RequirementExtractor(self.app.state.recommendation.store).extract(
            'Travel between day 4 and day 7',{},fields_override={'start_date':'2026-12-04','days':4})
        self.assertNotIn('start_date',extracted['draft'])
        self.assertIn('start_date',extracted['missing_fields'])

    def test_ambiguity_keeps_known_state_and_prevents_planning(self):
        case=acceptance.ChatAcceptance30('test_TC01')
        case.app=self.app
        cid=case.memory(case.context())
        response=Understanding(intent='trip_planning',fields={'party_size':3},clarification_required=True,answer='Which date?',ask_fields=['start_date'])
        with patch('app.llm.client.GeminiClient.generate',return_value=response),patch('app.tools.tool_registry.ToolRegistry.execute') as tool:
            result=self.client.post('/api/v1/chat',json={'user_id':'u','conversation_id':cid,'message':'Change the group and clarify the date','use_llm':True,'preview_only':True})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['status'],'needs_clarification')
        self.assertEqual(result.json()['extraction']['draft']['party_size'],3)
        self.assertEqual(result.json()['extraction']['draft']['days'],3)
        tool.assert_not_called()
