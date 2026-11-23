import unittest
from app.modules.trip_planner.input_gate import check_inputs


class InputGateTests(unittest.TestCase):
    def draft(self):
        return {'city':'Đà Nẵng','start_date':'2099-12-25','days':3,'preferences':['biển']}

    def test_date_alone_does_not_allow_planning(self):
        draft=self.draft();conv={}
        message=check_inputs('25/12/2099',draft,conv)
        self.assertIn('phương tiện',message);self.assertIn('số người',message)
        self.assertNotIn('transport',draft)

    def test_defaults_are_disclosed_and_need_separate_confirmation(self):
        draft=self.draft();conv={}
        self.assertIn('Xác nhận yêu cầu',check_inputs('dùng mặc định',draft,conv))
        self.assertEqual(draft['daily_window'],{'start':'09:00','end':'18:00'})
        self.assertIsNone(check_inputs('xác nhận',draft,conv))

    def test_changes_invalidate_confirmation(self):
        draft=self.draft();conv={};check_inputs('dùng mặc định',draft,conv)
        draft['party_size']=4
        self.assertIn('Xác nhận yêu cầu',check_inputs('xác nhận',draft,conv))
        self.assertIsNone(check_inputs('xác nhận',draft,conv))

    def test_no_confirmation_without_preferences_or_with_past_date(self):
        draft=self.draft();draft.pop('preferences');conv={}
        self.assertIn('sở thích',check_inputs('dùng mặc định',draft,conv))
        draft['preferences']=['biển'];draft['start_date']='2000-01-01'
        self.assertIn('đã qua',check_inputs('xác nhận',draft,conv))
