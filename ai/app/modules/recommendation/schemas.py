"""Public API contracts. IDs are opaque strings, not integers."""
from datetime import datetime, timezone
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator, field_validator

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class OpeningInterval(Contract):
    start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def order(self):
        if self.start >= self.end:
            raise ValueError("Khoảng mở cửa phải kết thúc sau bắt đầu, không qua đêm")
        return self


class PlaceData(Contract):
    place_id: Identifier
    name: Text
    place_type: Literal["Hotel", "Restaurant", "Attraction"]
    city: Text
    address: str | None = Field(None, max_length=2000)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    description: str | None = Field(None, max_length=20000)
    categories: list[Text] = Field(default_factory=list, max_length=100)
    amenities: list[Text] = Field(default_factory=list, max_length=100)
    tags: list[Text] = Field(default_factory=list, max_length=100)
    travel_styles: list[Text] = Field(default_factory=list, max_length=50)
    rating: float | None = Field(None, ge=1, le=5)
    review_count: int = Field(0, ge=0)
    budget: Text | None = None
    family_friendly: bool | None = None
    duration_minutes: int | None = Field(None, gt=0)
    opening_hours: str | None = Field(None, max_length=5000)
    weekly_opening_hours: dict[Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"], list[OpeningInterval]] | None = None
    suitable_time: str | None = Field(None, max_length=2000)
    closed_days: str | None = Field(None, max_length=2000)
    review_summary: str | None = Field(None, max_length=50000)
    image_url: str | None = Field(None, max_length=5000)
    image_urls: list[str] = Field(default_factory=list, max_length=1000)
    image_count: int | None = Field(None, ge=0)
    data_status: Text | None = None
    popularity_score: float | None = None
    ai_cluster_id: Text | None = None
    source_embedding_status: Text | None = None
    active: bool = True

    @field_validator('name','city','description','categories','amenities','tags','travel_styles')
    @classmethod
    def factual_encoding(cls,value):
        from .place_document import validate_encoding
        for text in value if isinstance(value,list) else [value]:
            if text is not None:validate_encoding(text)
        return value

    @model_validator(mode="after")
    def coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude và longitude phải có cùng nhau")
        return self


class PlaceBatch(Contract):
    places: list[PlaceData] = Field(min_length=1, max_length=100)


class PlaceEmbeddingResponse(Contract):
    place_id: str
    point_id: str
    model: str
    dimensions: int
    collection: str
    vector_name: str
    embedding: list[float]
    content_hash: str
    reused_embedding: bool
    indexed: bool


class PlaceEmbeddingBatchResponse(Contract):
    saved: int
    pending_index: int
    items: list[PlaceEmbeddingResponse]


class ReviewData(Contract):
    review_id: Identifier
    place_id: Identifier
    rating: float = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=20000)
    normalized_text: str | None = Field(None, max_length=20000)
    occurred_at: datetime
    use_for_embedding: bool = False
    cleaning_version: Text | None = None

    @model_validator(mode="after")
    def approved_text(self):
        if self.use_for_embedding and not self.normalized_text:
            raise ValueError("Review được chọn cần normalized_text; không dùng lại raw text")
        if self.use_for_embedding:
            from .place_document import validate_encoding
            validate_encoding(self.normalized_text)
        return self

    @model_validator(mode="after")
    def date_timezone(self):
        if self.occurred_at.tzinfo is None:
            raise ValueError("occurred_at phải có múi giờ")
        if self.occurred_at > datetime.now(timezone.utc):
            raise ValueError("occurred_at không được ở tương lai")
        return self


class ReviewBatch(Contract):
    reviews: list[ReviewData] = Field(min_length=1, max_length=100)


class UserPreferences(Contract):
    preferences: list[Text] = Field(default_factory=list, max_length=30)




class RecommendationRequest(Contract):
    user_id: Identifier
    include_service_places: bool = False
    preferences: list[Text] | None = Field(None, max_length=30)
    query: str | None = Field(None, min_length=1, max_length=2000)
    city: Text | None = None
    place_type: Literal["Hotel", "Restaurant", "Attraction"] | None = None
    category: Text | None = None
    budget: Text | None = None
    family_friendly: bool | None = None
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    radius_km: float | None = Field(None, gt=0, le=1000)
    exclude_place_ids: list[Identifier] = Field(default_factory=list, max_length=500)
    limit: int = Field(10, ge=1, le=100)

    @model_validator(mode="after")
    def location(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude và longitude phải có cùng nhau")
        if self.radius_km is not None and self.latitude is None:
            raise ValueError("radius_km cần latitude và longitude")
        return self


class RecommendationItem(Contract):
    place_id: str
    name: str
    place_type: str
    city: str
    score: float
    content_score: float | None = None
    quality_score: float
    rating: float | None = None
    review_count: int | None = None
    distance_km: float | None = None
    reasons: list[str]
    image_url: str | None = None
    effective_weights: dict[str,float] = Field(default_factory=dict)




class RecommendationResponse(Contract):
    request_id: str
    user_id: str
    total: int
    strategy: str
    model_version: str
    retrieval: str
    recommendations: list[RecommendationItem]
    diagnostics: dict[str,object] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
