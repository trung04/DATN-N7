import unittest
from unittest.mock import patch
import test_recommendation as fixtures
from app.agents.intent_router import IntentRouter
from app.agents.general_chat_agent import calculate

class IntentTests(unittest.TestCase):
    def test_supported_intents(self):
        router=IntentRouter()
        for message,intent in [("1+1 bằng bao nhiêu?","general_chat"),("Tìm khách sạn Đà Nẵng","place_search"),
            ("Bảo tàng mở cửa lúc nào?","travel_qa"),("Lập lịch Đà Nẵng 3 ngày","trip_planning"),
            ("Ngày 2 bỏ bảo tàng đi","replanning")]:
            self.assertEqual(router.classify(message),intent)

    def test_calculator_is_not_eval(self):
        self.assertEqual(calculate("2*(3+4)"),14)
        for value in ["__import__('os').getcwd()","2**99999","[1]*9999999"]:
            with self.assertRaises((ValueError,SyntaxError)):calculate(value)

class ChatTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def test_general_chat_never_searches_places(self):
        store=self.client.app.state.recommendation.store
        with patch.object(store,"places",side_effect=AssertionError("General chat must not search")):
            result=self.client.post('/api/v1/chat',json={'user_id':'u','message':'1+1 bằng bao nhiêu?'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['result']['answer'],'2')

    def test_shared_chat_clarification_date_and_math(self):
        self.seed(fixtures.place('a'),fixtures.place('b'))
        first=self.client.post('/api/v1/chat',json={'user_id':'u','message':'Lập lịch Đà Nẵng 2 ngày'}).json()
        self.assertEqual(first['status'],'needs_clarification')
        cid=first['conversation_id']
        math_result=self.client.post('/api/v1/chat',json={'user_id':'u','conversation_id':cid,'message':'1+1'}).json()
        self.assertEqual(math_result['intent'],'general_chat')
        result=self.client.post('/api/v1/chat',json={'user_id':'u','conversation_id':cid,'message':'2026-11-10'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['status'],'created')

    def test_chat_search_uses_inferred_constraints(self):
        self.seed(fixtures.place('a',place_type='Hotel',amenities=['Bể bơi']),fixtures.place('b'))
        result=self.client.post('/api/v1/chat',json={'user_id':'u','message':'Tìm khách sạn ở Đà Nẵng có hồ bơi'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual([r['place_id'] for r in result.json()['result']['results']],['a'])
