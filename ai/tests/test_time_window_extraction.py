import unittest
from unittest.mock import patch
from app.modules.trip_planner.time_parser import parse_daily_window
from app.agents.chat_understanding import Understanding
from tests import test_recommendation as fixtures


class TimeParserTests(unittest.TestCase):
    def test_explicit_clock_formats(self):
        for text,start,end in [('từ 9h đến 18h','09:00','18:00'),('9h–18h','09:00','18:00'),
            ('từ 9 giờ sáng đến 5 giờ chiều','09:00','17:00'),('9:30 - 18:15','09:30','18:15'),
            ('9h30 đến 18h15','09:30','18:15'),('từ 9 đến 18 giờ','09:00','18:00'),
            ('từ 9h tới 18h','09:00','18:00')]:
            with self.subTest(text=text):self.assertEqual(parse_daily_window(text),{'start':start,'end':end})
    def test_date_and_day_ranges_are_not_clock_ranges(self):
        for text in ['01/12/2026','2026-12-01','đi 3–5 ngày','từ ngày 1 đến ngày 3']:
            with self.subTest(text=text):self.assertIsNone(parse_daily_window(text))


class ChatTimeRecoveryTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown

    def test_exact_reported_message_does_not_reask_known_window(self):
        message='Lập lịch Đà Nẵng 1 ngày vào 01/12/2026, 2 người, đi ô tô, từ 9h đến 18h. Tôi thích biển và ẩm thực.'
        decision=Understanding(intent='trip_planning',fields={'city':'Đà Nẵng','days':1,'start_date':'2026-12-01',
            'party_size':2,'transport':'driving','preferences':['biển','ẩm thực']},
            clarification_required=True,ask_fields=['daily_window'],answer='Bạn cho mình biết khung giờ nhé?')
        with patch('app.llm.client.GeminiClient.generate',return_value=decision),patch('app.tools.tool_registry.ToolRegistry.execute') as tool:
            data=self.client.post('/api/v1/chat',json={'user_id':'u','message':message,'use_llm':True,'preview_only':True}).json()
        self.assertEqual(data['extraction']['draft']['daily_window'],{'start':'09:00','end':'18:00'})
        self.assertEqual(data['status'],'needs_clarification')
        self.assertIn('nhiều thời gian',data['message'])
        self.assertNotIn('khung giờ',data['message'])
        tool.assert_not_called()
