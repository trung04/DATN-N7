from app.core.config import env
from .schemas import ImageEmbeddingRequest, ImageEmbeddingResponse, ImageSearchRequest
"""CLIP image embeddings and a separate Qdrant image-search collection."""
import base64
import binascii
import io
import logging
import os
import threading
import uuid
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field, model_validator
from qdrant_client import models

from app.core.auth import authorize
from app.modules.recommendation.schemas import Contract, Identifier, Text

logger = logging.getLogger(__name__)


def decode_image(value, max_bytes=8_000_000, max_pixels=16_000_000):
    """Only uploaded bytes; never fetch arbitrary URLs from a backend request."""
    if value.startswith("data:"):
        header, separator, value = value.partition(",")
        if not separator or header not in ("data:image/jpeg;base64", "data:image/png;base64", "data:image/webp;base64"):
            raise ValueError("Data URL phải là JPEG, PNG hoặc WebP base64")
    if len(value) > ((max_bytes + 2) // 3) * 4:
        raise ValueError("Ảnh vượt giới hạn 8 MB")
    try:
        raw = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("image_base64 không hợp lệ") from exc
    if not raw or len(raw) > max_bytes:
        raise ValueError("Ảnh rỗng hoặc vượt giới hạn 8 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as original:
                if original.format not in ("JPEG", "PNG", "WEBP"):
                    raise ValueError("Chỉ nhận ảnh JPEG, PNG hoặc WebP")
                if original.width * original.height > max_pixels:
                    raise ValueError("Ảnh vượt giới hạn 16 triệu pixels")
                original.verify()
            with Image.open(io.BytesIO(raw)) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                image.load()
        return image
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError("Ảnh bị hỏng hoặc kích thước không an toàn") from exc


class ClipEmbeddingService:
    """Lazy-load exactly one image/text encoder, isolated from BGE."""
    def __init__(self):
        self.model_name = env("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
        self.dimensions = int(env("CLIP_DIMENSIONS", "512"))
        self.device = env("CLIP_DEVICE", "cpu")
        if self.dimensions <= 0:
            raise ValueError("CLIP_DIMENSIONS phải dương")
        self._model = None
        self._processor = None
        self._lock = threading.Lock()

    def _encode(self, value):
        import torch
        with self._lock:
            if self._model is None:
                from transformers import AutoProcessor, CLIPModel
                model = CLIPModel.from_pretrained(self.model_name).to(self.device).eval()
                processor = AutoProcessor.from_pretrained(self.model_name)
                if model.config.projection_dim != self.dimensions:
                    raise RuntimeError("CLIP_DIMENSIONS khác số chiều model; sửa cấu hình và dùng collection phù hợp")
                self._model, self._processor = model, processor
            if isinstance(value, str):
                tokens = self._processor.tokenizer(value, return_tensors="pt", truncation=False)
                if tokens["input_ids"].shape[-1] > self._model.config.text_config.max_position_embeddings:
                    raise ValueError("Truy vấn vượt giới hạn token của CLIP")
                inputs = {k: v.to(self.device) for k,v in tokens.items()}
                with torch.inference_mode():
                    features = self._model.get_text_features(**inputs)
            else:
                inputs = self._processor(images=value, return_tensors="pt")
                inputs = {k: v.to(self.device) for k,v in inputs.items()}
                with torch.inference_mode():
                    features = self._model.get_image_features(**inputs)
            # Transformers 4 returns Tensor; newer versions return projected pooler_output.
            if not isinstance(features, torch.Tensor):
                features = features.pooler_output
            return features[0].detach().float().cpu().numpy().tolist()

    def embed_image(self, image):
        return self._encode(image)

    def embed_text(self, text):
        return self._encode(text)


class ImageSearchService:
    def __init__(self, encoder, qdrant):
        self.encoder, self.qdrant = encoder, qdrant
        self.collection = env("IMAGE_COLLECTION_NAME", "tourism_images_clip_v1")
        self.vector_name = env("IMAGE_VECTOR_NAME", "image_dense")
        self.model_key = f"{encoder.model_name}:{encoder.dimensions}"
        self._collection_lock = threading.Lock()
        self._ready = False
        if self.collection in {env("RECOMMENDATION_COLLECTION", "tourism_places_v1"),
                                env("QDRANT_COLLECTION_NAME", "documents_bge_m3")}:
            raise ValueError("Collection ảnh phải tách khỏi collection văn bản/recommendation")

    def ensure_collection(self):
        with self._collection_lock:
            if not self.qdrant.collection_exists(self.collection):
                self.qdrant.create_collection(collection_name=self.collection, vectors_config={self.vector_name:
                    models.VectorParams(size=self.encoder.dimensions, distance=models.Distance.COSINE)})
            config = self.qdrant.get_collection(self.collection).config.params.vectors
            if (not isinstance(config, dict) or self.vector_name not in config or
                config[self.vector_name].size != self.encoder.dimensions or
                config[self.vector_name].distance != models.Distance.COSINE):
                raise RuntimeError("Collection ảnh sai named vector, dimensions hoặc distance; cần collection mới")
            self._ready = True

    def _embedding(self, image_base64=None, text=None):
        image = decode_image(image_base64) if image_base64 is not None else None
        try:
            try:
                result = self.encoder.embed_image(image) if image is not None else self.encoder.embed_text(text)
            except ValueError:
                raise
            except Exception as exc:
                logger.exception("CLIP inference unavailable")
                raise HTTPException(503, "Model CLIP chưa sẵn sàng; kiểm tra cache/model và thử lại") from exc
        finally:
            if image is not None:
                image.close()
        vector = np.asarray(result, dtype=np.float32)
        if vector.shape != (self.encoder.dimensions,) or not np.all(np.isfinite(vector)) or np.linalg.norm(vector) <= 1e-12:
            raise HTTPException(503, "CLIP trả vector không hợp lệ")
        return (vector / np.linalg.norm(vector)).tolist()

    def embed(self, body):
        vector = self._embedding(image_base64=body.image_base64)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"tourism-image:{body.image_id}")) if body.image_id else None
        if body.index:
            try:
                self.ensure_collection()
                self.qdrant.upsert(collection_name=self.collection, wait=True, points=[models.PointStruct(
                    id=point_id, vector={self.vector_name: vector}, payload={
                        "image_id": body.image_id, "place_id": body.place_id, "image_url": body.image_url,
                        "city": body.city.casefold() if body.city else None, "place_type": body.place_type,
                        "model": self.model_key})])
            except Exception as exc:
                logger.exception("Image index unavailable")
                raise HTTPException(503, "Không lưu được Qdrant; gửi lại cùng image_id để retry") from exc
        return ImageEmbeddingResponse(image_id=body.image_id, place_id=body.place_id, point_id=point_id,
            model=self.encoder.model_name, dimensions=self.encoder.dimensions, collection=self.collection,
            vector_name=self.vector_name, embedding=vector, indexed=body.index)

    def search(self, body):
        vector = self._embedding(image_base64=body.image_base64, text=body.text)
        conditions = [models.FieldCondition(key="model", match=models.MatchValue(value=self.model_key))]
        if body.city:
            conditions.append(models.FieldCondition(key="city", match=models.MatchValue(value=body.city.casefold())))
        if body.place_type:
            conditions.append(models.FieldCondition(key="place_type", match=models.MatchValue(value=body.place_type)))
        try:
            self.ensure_collection()
            response = self.qdrant.query_points(collection_name=self.collection, using=self.vector_name,
                query=vector, query_filter=models.Filter(must=conditions), limit=body.limit, with_payload=True)
        except Exception as exc:
            logger.exception("Image search unavailable")
            raise HTTPException(503, "Qdrant image search chưa sẵn sàng") from exc
        return {"model": self.encoder.model_name, "collection": self.collection, "total": len(response.points),
            "results": [{"point_id": str(p.id), "score": p.score, **(p.payload or {})} for p in response.points]}

