import json
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from tests import test_recommendation as fixtures
from app.agents.chat_understanding import Understanding,understand
from app.memory.conversation_store import ConversationStore
from app.modules.trip_planner.requirement_extractor import RequirementExtractor


class NaturalChatTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def chat(self,message,**extra):
        response=self.client.post('/api/v1/chat',json={'user_id':'u','message':message,'preview_only':True,'use_llm':True,**extra})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_math_bypasses_llm_and_tools_even_during_planning(self):
        memory=ConversationStore(self.app.state.recommendation.store)
        conv=memory.get(None,'u');conv['draft']={'city':'Đà Nẵng','days':3};memory.save('u',conv)
        with patch('app.llm.client.GeminiClient.generate',side_effect=AssertionError('No LLM')),patch('app.tools.tool_registry.ToolRegistry.execute',side_effect=AssertionError('No tools')):
            result=self.chat('1+1',conversation_id=conv['conversation_id'])
        self.assertEqual(result['result']['answer'],'2')
        self.assertEqual(memory.get(conv['conversation_id'],'u')['draft'],conv['draft'])

    def test_off_topic_uses_one_llm_and_preserves_pending_requirements(self):
        memory=ConversationStore(self.app.state.recommendation.store)
        conv=memory.get(None,'u');conv['draft']={'city':'Huế','days':2};memory.save('u',conv)
        decision=Understanding(intent='general_chat',answer='Mình chưa đủ thông tin để trả lời chắc chắn câu này.')
        with patch('app.llm.client.GeminiClient.generate',return_value=decision) as llm,patch('app.tools.tool_registry.ToolRegistry.execute',side_effect=AssertionError('No travel tool')):
            result=self.chat('Giải thích một vấn đề chuyên ngành giúp tôi',conversation_id=conv['conversation_id'])
        self.assertEqual(llm.call_count,1)
        self.assertEqual(result['result']['answer'],decision.answer)
        self.assertEqual(memory.get(conv['conversation_id'],'u')['draft'],conv['draft'])

    def test_complete_turn_creates_plan_once_without_confirmation_or_extra_llm(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        decision=Understanding(intent='trip_planning',fields={'city':'Đà Nẵng','days':1,'start_date':'2099-12-25','preferences':['biển'],'party_size':2,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}})
        def matrix(points,*args):
            n=len(points);return {'source':'ors','estimated':False,'warnings':[], 'minutes':[[0 if i==j else 5 for j in range(n)] for i in range(n)],'kilometers':[[0 if i==j else 1 for j in range(n)] for i in range(n)]}
        with patch('app.llm.client.GeminiClient.generate',return_value=decision) as llm,patch('app.modules.trip_planner.ors_matrix.OrsMatrix.build',side_effect=matrix):
            result=self.chat('Tạo chuyến đi theo yêu cầu của tôi, khởi hành 25/12/2099')
        self.assertEqual(result['status'],'preview_created');self.assertIsNotNone(result['trip'])
        self.assertEqual(llm.call_count,1)

    def test_only_missing_info_is_asked_and_requirements_accumulate(self):
        with patch('app.llm.client.GeminiClient.generate',side_effect=[Understanding(intent='trip_planning',fields={'city':'Đà Nẵng','days':3}),Understanding(intent='trip_planning',fields={'start_date':'2099-12-25'})]):
            first=self.chat('Đà Nẵng 3 ngày')
            second=self.chat('25/12/2099',conversation_id=first['conversation_id'])
        self.assertNotIn('ngày khởi hành',second['message']);self.assertNotIn('điểm đến',second['message'])
        draft=ConversationStore(self.app.state.recommendation.store).get(first['conversation_id'],'u')['draft']
        self.assertEqual(draft['city'],'Đà Nẵng');self.assertEqual(draft['days'],3)

    def test_llm_can_ask_naturally_but_cannot_ask_again_for_known_fields(self):
        base={'city':'Đà Nẵng','days':3}
        question='Bạn định khởi hành ngày nào, và thích trải nghiệm gì nhất?'
        with patch('app.llm.client.GeminiClient.generate',return_value=Understanding(intent='trip_planning',fields=base,answer=question,ask_fields=['start_date','preferences'])):
            result=self.chat('Lập lịch Đà Nẵng 3 ngày')
        self.assertEqual(result['message'],question)
        with patch('app.llm.client.GeminiClient.generate',return_value=Understanding(intent='trip_planning',fields=base,answer='Bạn muốn đến thành phố nào?',ask_fields=['city'])):
            result=self.chat('Lập lịch Đà Nẵng 3 ngày')
        self.assertNotIn('thành phố nào',result['message'])

    def test_city_change_clears_stale_coordinates_not_preferences(self):
        extractor=RequirementExtractor(self.app.state.recommendation.store)
        context={'city':'Đà Nẵng','days':3,'preferences':['biển'],'query':'biển yên tĩnh','required_place_ids':['old'], 'start_location':{'latitude':16,'longitude':108}}
        result=extractor.extract('Đổi sang Huế',context,fields_override={'city':'Huế'})['draft']
        self.assertEqual(result['preferences'],['biển']);self.assertEqual(result['query'],'biển yên tĩnh')
        self.assertNotIn('start_location',result);self.assertNotIn('required_place_ids',result)

    def test_adding_people_is_not_interpreted_as_adding_a_place(self):
        extractor=RequirementExtractor(self.app.state.recommendation.store)
        extracted=extractor.extract('Thêm 1 người',{'party_size':2},fields_override={'party_size':3})
        self.assertEqual(extracted['draft']['party_size'],3)
        self.assertNotIn('add_text',extracted['fields'])

    def test_history_is_bounded_and_provider_errors_are_not_exposed(self):
        conversation={'draft':{'city':'Huế','opening_overrides':{'secret':'large'}},'messages':[{'role':'user','text':'x'*2000} for _ in range(40)]}
        with patch('app.llm.client.GeminiClient.generate',return_value=Understanding(intent='general_chat',answer='Được nhé.')) as llm:
            understand('xin tư vấn',conversation,False)
        payload=json.loads(llm.call_args.args[1]);self.assertEqual(len(payload['recent_messages']),6)
        self.assertLessEqual(max(len(m['text']) for m in payload['recent_messages']),350)
        self.assertNotIn('opening_overrides',payload['requirements'])
        with patch('app.llm.client.GeminiClient.generate',side_effect=HTTPException(503,'INTERNAL GEMINI_API_KEY secret')):
            result=self.chat('Tôi muốn đi chơi')
        self.assertEqual(result['status'],'temporarily_unavailable');self.assertNotIn('secret',json.dumps(result))

    def test_numeric_clarification_is_not_mistaken_for_a_math_question(self):
        memory=ConversationStore(self.app.state.recommendation.store)
        conv=memory.get(None,'u');conv['draft']={'city':'Huế','days':2,'start_date':'2099-12-25','preferences':['văn hóa']}
        conv['pending_fields']=['party_size','transport','daily_window'];memory.save('u',conv)
        with patch('app.llm.client.GeminiClient.generate',side_effect=AssertionError('No extra LLM')):
            result=self.chat('2',conversation_id=conv['conversation_id'])
        self.assertEqual(result['status'],'needs_clarification')
        self.assertEqual(memory.get(conv['conversation_id'],'u')['draft']['party_size'],2)
        self.assertNotIn('số người',result['message'])

    def test_reference_to_a_recent_place_reads_details_without_another_search(self):
        from app.tools.tool_registry import ToolRegistry
        self.seed(fixtures.place('a',name='Bãi biển A',address='Đường ven biển'))
        memory=ConversationStore(self.app.state.recommendation.store)
        conv=memory.get(None,'u');conv['recent_places']=[{'place_id':'a','name':'Bãi biển A'}];memory.save('u',conv)
        decision=Understanding(intent='travel_qa',fields={'required_place_names':['Bãi biển A']})
        original=ToolRegistry.execute
        def execute(registry,name,args):
            self.assertEqual(name,'place_details')
            return original(registry,name,args)
        with patch('app.llm.client.GeminiClient.generate',return_value=decision) as llm,patch.object(ToolRegistry,'execute',autospec=True,side_effect=execute) as tool:
            result=self.chat('Địa chỉ chỗ đó ở đâu?',conversation_id=conv['conversation_id'])
        self.assertEqual(llm.call_count,1);self.assertEqual(tool.call_count,1)
        self.assertIn('Đường ven biển',result['result']['answer'])
