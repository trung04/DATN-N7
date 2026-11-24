import base64
import io
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from qdrant_client import QdrantClient, models

from app.main import create_app
from app.modules.semantic_search.image_search import decode_image
from test_recommendation import FakeEmbedding


def image_data(color="red"):
    with Image.new("RGB", (16, 16), color) as image:
        stream = io.BytesIO()
        image.save(stream, format="PNG")
        return base64.b64encode(stream.getvalue()).decode()


class FakeClip:
    model_name = "fake-clip"
    dimensions = 3

    def embed_image(self, image):
        return list(image.getpixel((0, 0)))

    def embed_text(self, text):
        return [255, 0, 0] if "red" in text else [0, 0, 255]


class ImageAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.qdrant = QdrantClient(":memory:")
        self.clip = FakeClip()
        self.env = patch.dict(os.environ, {"RECOMMENDATION_API_KEY": "", "IMAGE_COLLECTION_NAME": "test_images",
            "IMAGE_VECTOR_NAME": "image_dense", "RECOMMENDATION_COLLECTION": "test_places"})
        self.env.start()
        self.client = TestClient(create_app(embedding=FakeEmbedding(), clip_embedding=self.clip,
            qdrant=self.qdrant, db_path=self.temp.name + "/db.sqlite"))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.qdrant.close()
        self.env.stop()
        self.temp.cleanup()

    def embed(self, image_id="red-1", color="red", **kwargs):
        return self.client.post("/api/v1/embeddings/image", json={"image_id": image_id, "place_id": "place-1",
            "image_base64": image_data(color), "city": "Đà Nẵng", "place_type": "Attraction", **kwargs})

    def test_collection_created_without_loading_model(self):
        info = self.client.get("/api/v1/search/images/collection").json()
        self.assertEqual(info["collection"], "test_images")
        self.assertEqual(info["dimensions"], 3)
        self.assertEqual(info["points_count"], 0)

    def test_embed_normalized_and_idempotent(self):
        result = self.embed()
        self.assertEqual(result.status_code, 200, result.text)
        body = result.json()
        self.assertEqual(body["embedding"], [1, 0, 0])
        self.assertTrue(body["indexed"])
        self.assertEqual(self.embed().json()["point_id"], body["point_id"])
        self.assertEqual(self.qdrant.count("test_images").count, 1)
        self.embed(image_id="blue-1", color="blue")
        self.assertEqual(self.qdrant.count("test_images").count, 2)

    def test_embed_without_index_or_ids(self):
        response = self.client.post("/api/v1/embeddings/image", json={"image_base64": image_data(), "index": False})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["indexed"])
        self.assertIsNone(response.json()["point_id"])
        self.assertEqual(self.qdrant.count("test_images").count, 0)

    def test_upload_default_preview_and_index(self):
        raw=base64.b64decode(image_data())
        response=self.client.post('/api/v1/embeddings/image/upload',files={'file':('red.png',raw,'image/png')})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['embedding'],[1,0,0])
        self.assertFalse(response.json()['indexed'])
        self.assertEqual(self.qdrant.count('test_images').count,0)
        indexed=self.client.post('/api/v1/embeddings/image/upload',files={'file':('red.png',raw,'image/png')},
            data={'index':'true','image_id':'upload-1','place_id':'place-1','city':'Đà Nẵng'})
        self.assertEqual(indexed.status_code,200,indexed.text)
        self.assertTrue(indexed.json()['indexed'])
        self.assertEqual(self.qdrant.count('test_images').count,1)

    def test_upload_search_and_validation(self):
        self.embed()
        raw=base64.b64decode(image_data())
        result=self.client.post('/api/v1/search/images/upload',files={'file':('red.png',raw,'image/png')},data={'limit':'1','city':'Đà Nẵng'})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['results'][0]['image_id'],'red-1')
        self.assertEqual(self.qdrant.count('test_images').count,1)
        for raw in (b'',b'not an image'):
            result=self.client.post('/api/v1/embeddings/image/upload',files={'file':('fake.png',raw,'image/png')})
            self.assertEqual(result.status_code,422,result.text)
        result=self.client.post('/api/v1/embeddings/image/upload',files={'file':('big.png',b'x'*8_000_001,'image/png')})
        self.assertEqual(result.status_code,413,result.text)
        result=self.client.post('/api/v1/embeddings/image/upload',files={'file':('red.png',base64.b64decode(image_data()),'image/png')},data={'index':'true'})
        self.assertEqual(result.status_code,422,result.text)
        self.assertEqual(self.client.post('/api/v1/embeddings/image/upload').status_code,422)

    def test_upload_auth_and_swagger_file_input(self):
        with patch.dict(os.environ,{'RECOMMENDATION_API_KEY':'secret'}):
            result=self.client.post('/api/v1/embeddings/image/upload',files={'file':('red.png',base64.b64decode(image_data()),'image/png')})
            self.assertEqual(result.status_code,401)
        spec=self.client.get('/openapi.json').json()
        for path in ['/api/v1/embeddings/image/upload','/api/v1/search/images/upload']:
            content=spec['paths'][path]['post']['requestBody']['content']
            self.assertIn('multipart/form-data',content)
            ref=content['multipart/form-data']['schema']['$ref'].split('/')[-1]
            self.assertEqual(spec['components']['schemas'][ref]['properties']['file']['format'],'binary')

    def test_image_and_text_search(self):
        self.embed()
        self.embed(image_id="blue-1", color="blue")
        for query in [{"image_base64": image_data()}, {"text": "a red beach"}]:
            response = self.client.post("/api/v1/search/images", json=query)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["results"][0]["image_id"], "red-1")
            self.assertAlmostEqual(response.json()["results"][0]["score"], 1, places=5)

    def test_search_filters(self):
        self.embed()
        self.embed(image_id="other", city="Huế")
        response = self.client.post("/api/v1/search/images", json={"text": "red", "city": "đà nẵng"}).json()
        self.assertEqual(response["total"], 1)
        self.assertEqual(response["results"][0]["image_id"], "red-1")

    def test_model_payload_filter(self):
        self.embed()
        self.client.app.state.image_search.model_key = "another-clip:3"
        self.assertEqual(self.client.post("/api/v1/search/images", json={"text": "red"}).json()["total"], 0)

    def test_invalid_images_and_contract(self):
        for value in ["invalid%%", base64.b64encode(b"not an image").decode()]:
            response = self.embed(image_base64=value)
            self.assertEqual(response.status_code, 422, response.text)
        for query in [{}, {"text": "red", "image_base64": image_data()}]:
            self.assertEqual(self.client.post("/api/v1/search/images", json=query).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/embeddings/image", json={"image_base64": image_data()}).status_code, 422)

    def test_auth(self):
        with patch.dict(os.environ, {"RECOMMENDATION_API_KEY": "secret"}):
            self.assertEqual(self.embed().status_code, 401)
            self.assertEqual(self.client.post("/api/v1/search/images", json={"text": "red"}).status_code, 401)

    def test_qdrant_failure_returns_retryable_error(self):
        with patch.object(self.qdrant, "upsert", side_effect=RuntimeError("offline")):
            with self.assertLogs("app.modules.semantic_search.image_search", level="ERROR"):
                self.assertEqual(self.embed().status_code, 503)
        self.assertEqual(self.embed().status_code, 200)

    def test_wrong_collection_not_recreated(self):
        self.qdrant.delete_collection("test_images")
        self.qdrant.create_collection("test_images", vectors_config={"wrong": models.VectorParams(size=10, distance=models.Distance.DOT)})
        with self.assertLogs("app.modules.semantic_search.image_search", level="ERROR"):
            self.assertEqual(self.embed().status_code, 503)
        self.assertEqual(self.qdrant.get_collection("test_images").config.params.vectors["wrong"].size, 10)


class ImageDecodeTests(unittest.TestCase):
    def test_data_url_and_limits(self):
        image = decode_image("data:image/png;base64," + image_data())
        self.assertEqual(image.mode, "RGB")
        image.close()
        with self.assertRaises(ValueError):
            decode_image(image_data(), max_bytes=1)
        with self.assertRaises(ValueError):
            decode_image(image_data(), max_pixels=1)
        with self.assertRaises(ValueError):
            decode_image("data:image/svg+xml;base64," + image_data())


if __name__ == "__main__":
    unittest.main()
