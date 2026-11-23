import base64
import hashlib
import unittest
from unittest.mock import patch
from tests import test_image_search as images
from tests import test_recommendation as fixtures
from PIL import Image
import io

def indexing_image():
    output=io.BytesIO()
    with Image.new("RGB",(224,224),"red") as image:image.save(output,format="PNG")
    return base64.b64encode(output.getvalue()).decode()

class IndexingTests(unittest.TestCase):
    setUp = images.ImageAPITests.setUp
    tearDown = images.ImageAPITests.tearDown

    def post(self, **fields):
        return self.client.post('/api/v1/indexing/apply',json=fields)

    def text(self, revision=1, **extra):
        return self.post(kind='TEXT_UPSERT',resource_id='a',place_id='a',revision=revision,
                         place=fixtures.place('a', **extra))

    def test_text_timings_and_idempotent_retry(self):
        first=self.text();self.assertEqual(first.status_code,200,first.text)
        self.assertTrue({'PREPROCESS','EMBEDDING','QDRANT_WRITE'} <= set(first.json()['timings_ms']))
        calls=self.client.app.state.recommendation.embedding.calls
        again=self.text();self.assertTrue(again.json()['replayed'])
        self.assertEqual(again.json()['timings_ms'],{})
        self.assertEqual(self.client.app.state.recommendation.embedding.calls,calls)

    def test_new_revision_reuses_embedding_and_stale_cannot_overwrite(self):
        self.text(2,name='New')
        old=self.text(1,name='Old');self.assertEqual(old.json()['status'],'SUPERSEDED')
        self.assertEqual(self.client.get('/api/v1/places/a').json()['place']['name'],'New')
        self.assertTrue(self.text(3,name='New').json()['reused_embedding'])

    def test_delete_tombstone_blocks_old_upsert(self):
        self.text()
        result=self.post(kind='TEXT_DELETE',resource_id='a',place_id='a',revision=3)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.text(2).json()['status'],'SUPERSEDED')
        self.assertEqual(self.client.get('/api/v1/places').json()['total'],0)

    def test_pending_qdrant_write_can_be_retried(self):
        svc=self.client.app.state.recommendation
        with patch.object(svc.content,'upsert',side_effect=RuntimeError('offline')):
            self.assertEqual(self.text().status_code,503)
        self.assertEqual(self.text().json()['status'],'SUCCEEDED')

    def test_image_reuse_checksum_and_delete(self):
        data=indexing_image()
        body=dict(kind='IMAGE_UPSERT',resource_id='pic',place_id='a',revision=1,
            content_hash=hashlib.sha256(base64.b64decode(data)).hexdigest(),
            image={'image_id':'pic','place_id':'a','image_base64':data,'index':True})
        first=self.post(**body);self.assertEqual(first.status_code,200,first.text)
        self.assertFalse(first.json()['reused_embedding'])
        self.assertTrue(self.post(**{**body,'revision':2}).json()['reused_embedding'])
        self.assertEqual(self.post(**{**body,'revision':3,'content_hash':'0'*64}).status_code,422)
        deleted=self.post(kind='IMAGE_DELETE',resource_id='pic',place_id='a',revision=4)
        self.assertEqual(deleted.status_code,200,deleted.text)
        self.assertEqual(self.qdrant.count('test_images').count,0)
        self.assertEqual(self.post(**{**body,'revision':3}).json()['status'],'SUPERSEDED')

    def test_mismatched_place_identifiers_rejected(self):
        result=self.post(kind='TEXT_UPSERT',resource_id='b',place_id='a',revision=1,place=fixtures.place('a'))
        self.assertEqual(result.status_code,422)

    def test_full_metadata_and_semantic_document(self):
        from app.modules.recommendation.place_document import place_document
        p=fixtures.place('a',tags=['beach'],amenities=['parking'],best_visit_times=['early morning'],
            suitable_for=['family'],duration_minutes=120,weekly_opening_hours={'mon':[{'start':'00:00','end':'23:59'}]},
            price={'is_free':True,'min_price':0,'max_price':0,'currency':'VND'},contact={'phone':None,'website':None},source='MANUAL')
        response=self.post(kind='TEXT_UPSERT',resource_id='a',place_id='a',revision=1,place=p)
        self.assertEqual(response.status_code,200,response.text)
        saved=self.client.get('/api/v1/places/a').json()['place']
        self.assertEqual(saved['duration_minutes'],120);self.assertEqual(saved['price']['is_free'],True)
        document=place_document(saved)
        for term in ['beach','parking','early morning','family']:self.assertIn(term,document)
        self.assertNotIn('VND',document);self.assertNotIn('MANUAL',document)
