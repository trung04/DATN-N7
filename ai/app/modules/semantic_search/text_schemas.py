"""Public contracts for text embeddings and place search."""
from typing import Literal
from pydantic import BaseModel, Field, model_validator, field_validator
from app.modules.recommendation.schemas import Contract, Identifier, Text
from .text_utils import feature_key

class TextEmbeddingRequest(BaseModel):
    text: str = Field(...,min_length=1, description ="Chuỗi văn bản cần được xử lý để tạo embedding. Chuỗi này không được rỗng.")

class BatchEmbeddingRequest(BaseModel):
    text: list[str] = Field(...,min_length=1, description ="Danh sách các chuỗi văn bản cần được xử lý để tạo embedding. Danh sách này không được rỗng.")


class TextEmbeddingResponse(BaseModel):
    model : str
    dimensions : int
    embedding : list[float]


class BatchEmbeddingResponse(BaseModel):
    model: str
    dimensions: int
    embeddings : list[list[float]]

class SearchFilters(Contract):
    city: Text | None = None
    place_type: Literal["Hotel", "Restaurant", "Attraction"] | None = None
    category: Text | None = None
    amenities: list[Text] = Field(default_factory=list, max_length=30)
    excluded_amenities: list[Text] = Field(default_factory=list, max_length=30)
    budget: Text | None = None
    family_friendly: bool | None = None
    min_rating: float | None = Field(None, ge=1, le=5)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    radius_km: float | None = Field(None, gt=0, le=1000)
    exclude_place_ids: list[Identifier] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def constraints(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude và longitude phải có cùng nhau")
        if self.radius_km is not None and self.latitude is None:
            raise ValueError("radius_km cần tọa độ tham chiếu")
        if {feature_key(x) for x in self.amenities} & {feature_key(x) for x in self.excluded_amenities}:
            raise ValueError("Tiện ích không thể vừa bắt buộc vừa bị loại")
        return self

class PlaceSearchRequest(Contract):
    method: Literal['hybrid', 'bge', 'bm25'] = 'hybrid'
    query: str = Field(min_length=1, max_length=2000)
    filters: SearchFilters = Field(default_factory=SearchFilters)
    infer_filters: bool = True
    limit: int = Field(10, ge=1, le=100)
    offset: int = Field(0, ge=0, le=10000)
    min_similarity: float | None = Field(None, ge=-1, le=1)

    @field_validator('query')
    @classmethod
    def meaningful_query(cls, value):
        from .text_utils import folded
        if not folded(value):
            raise ValueError('query must contain searchable letters or digits')
        return value.strip()

    @model_validator(mode='after')
    def semantic_threshold(self):
        if self.method == 'bm25' and self.min_similarity is not None:
            raise ValueError('min_similarity is not applicable to BM25')
        return self

class PlaceSearchItem(Contract):
    place_id: str
    name: str
    place_type: str
    city: str
    score: float
    semantic_score: float | None
    keyword_score: float
    exact_name_match: bool
    distance_km: float | None
    image_url: str | None
    reasons: list[str]

class PlaceSearchResponse(Contract):
    request_id: str
    query: str
    parser: str
    inferred_filters: dict[str, object]
    applied_filters: dict[str, object]
    unsupported_requirements: list[str]
    warnings: list[str]
    retrieval: str
    model: str
    total: int
    offset: int
    limit: int
    results: list[PlaceSearchItem]
