import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError,URLError
from fastapi import HTTPException
from app.agents.general_chat_agent import Answer
from app.llm.client import GeminiClient


def valid():
    return io.BytesIO(json.dumps({'candidates':[{'content':{'parts':[{'text':'{"answer":"OK"}'}]}}]}).encode())


class GeminiResilienceTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict('os.environ',{'GEMINI_API_KEY':'test-key-never-real','GEMINI_MODEL':'test-model'})
        self.env.start();self.addCleanup(self.env.stop)

    @patch('app.llm.client.time.sleep')
    @patch('app.llm.client.urlopen')
    def test_temporary_503_retries_and_recovers(self,open_url,sleep):
        open_url.side_effect=[HTTPError('https://example.invalid',503,'busy',{},None),valid()]
        self.assertEqual(GeminiClient().generate('system','hello',Answer).answer,'OK')
        self.assertEqual(open_url.call_count,2);sleep.assert_called_once()

    @patch('app.llm.client.time.sleep')
    @patch('app.llm.client.urlopen')
    def test_retry_limit_and_sanitized_error(self,open_url,sleep):
        open_url.side_effect=[HTTPError('https://example.invalid',503,'SECRET-PROVIDER-BODY',{},None) for _ in range(3)]
        with self.assertRaises(HTTPException) as raised:GeminiClient().generate('system','hello',Answer)
        self.assertEqual(open_url.call_count,3);self.assertNotIn('SECRET',raised.exception.detail)
        self.assertNotIn('test-key',raised.exception.detail)

    @patch('app.llm.client.urlopen')
    def test_permanent_403_and_404_do_not_retry(self,open_url):
        for status in [400,401,403,404]:
            open_url.reset_mock();open_url.side_effect=HTTPError('https://example.invalid',status,'error',{},None)
            with self.assertRaises(HTTPException):GeminiClient().generate('system','hello',Answer)
            self.assertEqual(open_url.call_count,1)

    @patch('app.llm.client.time.sleep')
    @patch('app.llm.client.urlopen')
    def test_invalid_json_and_connection_failure_retry(self,open_url,sleep):
        open_url.side_effect=[URLError('offline'),io.BytesIO(b'{bad json'),valid()]
        self.assertEqual(GeminiClient().generate('system','hello',Answer).answer,'OK')
        self.assertEqual(open_url.call_count,3)

    @patch('app.llm.client.time.sleep')
    @patch('app.llm.client.time.monotonic')
    @patch('app.llm.client.urlopen')
    def test_total_deadline_stops_additional_calls(self,open_url,clock,sleep):
        clock.side_effect=[0,0,31]
        open_url.side_effect=TimeoutError()
        with self.assertRaises(HTTPException):GeminiClient().generate('system','hello',Answer)
        self.assertEqual(open_url.call_count,1);sleep.assert_not_called()
