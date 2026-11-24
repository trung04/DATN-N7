"""Image contracts plus backward-compatible text contract exports."""
from pydantic import Field
from pydantic import model_validator
from app.modules.recommendation.schemas import Contract, Identifier, Text

class ImageEmbeddingRequest(Contract):
    image_base64: str = Field(min_length=1, max_length=12_000_000)
    image_id: Identifier | None = None
    place_id: Identifier | None = None
    image_url: str | None = Field(None, max_length=5000)
    city: Text | None = None
    place_type: Text | None = None
    index: bool = True

    @model_validator(mode="after")
    def indexed_ids(self):
        if self.index and (not self.image_id or not self.place_id):
            raise ValueError("index=true cần image_id và place_id")
        return self

class ImageEmbeddingResponse(Contract):
    image_id: str | None
    place_id: str | None
    point_id: str | None
    model: str
    dimensions: int
    collection: str
    vector_name: str
    embedding: list[float]
    indexed: bool

class ImageSearchRequest(Contract):
    image_base64: str | None = Field(None, min_length=1, max_length=12_000_000)
    text: str | None = Field(None, min_length=1, max_length=300)
    city: Text | None = None
    place_type: Text | None = None
    limit: int = Field(10, ge=1, le=100)

    @model_validator(mode="after")
    def one_query(self):
        if (self.image_base64 is None) == (self.text is None):
            raise ValueError("Gửi đúng một trong image_base64 hoặc text")
        return self

from .text_schemas import (TextEmbeddingRequest, TextEmbeddingResponse,
    BatchEmbeddingRequest, BatchEmbeddingResponse, SearchFilters,
    PlaceSearchRequest, PlaceSearchItem, PlaceSearchResponse)
