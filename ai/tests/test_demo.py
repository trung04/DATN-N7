import unittest
import test_recommendation as fixtures


class DemoTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown

    def test_demo_page_and_forms(self):
        response=self.client.get('/demo')
        self.assertEqual(response.status_code,200,response.text)
        self.assertIn('text/html',response.headers['content-type'])
        self.assertEqual(response.headers['cache-control'],'no-store')
        for value in ('id="imageFile"','id="placeForm"','id="recForm"','id="chatForm"','id="tripForm"'):
            self.assertIn(value,response.text)
        self.assertIn('/api/v1/embeddings/image/upload',response.text)
        self.assertIn('/api/v1/search/images/upload',response.text)

    def test_demo_keeps_requests_same_origin_and_keys_in_memory(self):
        html=self.client.get('/demo').text
        self.assertNotIn('localStorage',html)
        self.assertNotIn('sessionStorage',html)
        self.assertNotIn('innerHTML',html)
        self.assertIn('<script src="/demo-assets/explore.js">',html)
        self.assertIn('type="password"',html)
        self.assertNotIn('/api/v1/interactions',html)
        self.assertNotIn('/api/v1/impressions',html)
        self.assertNotIn('id="exploration"',html)
