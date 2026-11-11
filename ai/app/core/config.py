"""Single environment boundary. Secrets are never included in the Settings repr."""
import os
import math
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

PROJECT_ROOT=Path(__file__).resolve().parents[2]
def load_environment():
    load_dotenv(PROJECT_ROOT / ".env", override=False)
def env(name, default=None):
    return os.getenv(name,default)
load_environment()

@dataclass(frozen=True)
class Settings:
    model_name: str
    qdrant_url: str
    document_collection: str
    recommendation_collection: str
    vector_name: str
    db_path: str
    api_key: str | None = field(repr=False)
    gemini_api_key: str | None = field(repr=False)
    gemini_model: str | None = None

    @classmethod
    def from_env(cls):
        return cls(env("MODEL_NAME","BAAI/bge-m3"), env("QDRANT_URL","http://localhost:6333"),
            env("QDRANT_COLLECTION_NAME","documents_bge_m3"),env("RECOMMENDATION_COLLECTION","documents_bge_m3"),
            env("RECOMMENDATION_VECTOR_NAME","dense"),env("RECOMMENDATION_DB_PATH","data/recommendation.sqlite3"),
            env("RECOMMENDATION_API_KEY"),env("GEMINI_API_KEY"),env("GEMINI_MODEL"))

@dataclass(frozen=True)
class RankingConfig:
    content_weight: float = 0.60
    quality_weight: float = 0.20
    prior_strength: float = 50.0
    candidate_limit: int = 500
    max_interest_groups: int = 3

    def __post_init__(self):
        for name in ("content_weight", "quality_weight"):
            if not math.isfinite(getattr(self, name)) or getattr(self, name) < 0:
                raise ValueError(f"{name} phải hữu hạn và không âm")
        if not math.isfinite(self.prior_strength) or self.prior_strength <= 0:
            raise ValueError("prior_strength phải dương")
        if self.quality_weight <= 0:
            raise ValueError("quality_weight phải dương")
        if self.candidate_limit < 100:
            raise ValueError("candidate_limit >= 100")
        if not 1 <= self.max_interest_groups <= 10:
            raise ValueError("max_interest_groups phải trong [1,10]")

    @classmethod
    def from_env(cls):
        values = {}
        for name, field in cls.__dataclass_fields__.items():
            value = env("REC_" + name.upper())
            if value is not None:
                values[name] = int(value) if isinstance(field.default, int) else float(value)
        return cls(**values)
