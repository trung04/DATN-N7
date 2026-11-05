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
        if env("DATABASE_BACKEND","sqlite") != "sqlite":
            raise RuntimeError("Runtime repositories currently use SQLite. PostgreSQL requires a separate schema/data migration.")
        return cls(env("MODEL_NAME","BAAI/bge-m3"), env("QDRANT_URL","http://localhost:6333"),
            env("QDRANT_COLLECTION_NAME","documents_bge_m3"),env("RECOMMENDATION_COLLECTION","documents_bge_m3"),
            env("RECOMMENDATION_VECTOR_NAME","dense"),env("RECOMMENDATION_DB_PATH","data/recommendation.sqlite3"),
            env("RECOMMENDATION_API_KEY"),env("GEMINI_API_KEY"),env("GEMINI_MODEL"))

@dataclass(frozen=True)
class RankingConfig:
    mode: str = "content_rating"
    content_weight: float = 0.60
    quality_weight: float = 0.20
    distance_weight: float = 0.10
    collaborative_weight: float = 0.10
    prior_strength: float = 50.0
    half_life_days: float = 90.0
    distance_half_km: float = 10.0
    exploration_rate: float = 0.10
    diversity_penalty: float = 0.08
    candidate_limit: int = 500
    min_collaborative_users: int = 3
    max_interest_groups: int = 3
    repeat_penalty: float = 0.05

    def __post_init__(self):
        if self.mode not in {"content_rating", "hybrid"}:
            raise ValueError("REC_MODE must be content_rating or hybrid")
        for name in ("content_weight", "quality_weight", "distance_weight", "collaborative_weight", "diversity_penalty"):
            if not math.isfinite(getattr(self, name)) or getattr(self, name) < 0:
                raise ValueError(f"{name} phải hữu hạn và không âm")
        for name in ("prior_strength", "half_life_days", "distance_half_km"):
            if not math.isfinite(getattr(self, name)) or getattr(self, name) <= 0:
                raise ValueError(f"{name} phải dương")
        if self.quality_weight <= 0 or not 0 <= self.exploration_rate <= 0.3:
            raise ValueError("quality_weight phải dương; exploration_rate trong [0,0.3]")
        if self.candidate_limit < 100 or self.min_collaborative_users < 2:
            raise ValueError("candidate_limit >=100 và min_collaborative_users >=2")
        if not 1<=self.max_interest_groups<=10 or not 0<=self.repeat_penalty<=0.3:
            raise ValueError("Invalid interest group limit/repeat penalty")

    @classmethod
    def from_env(cls):
        values = {}
        for name, field in cls.__dataclass_fields__.items():
            value = env("REC_" + name.upper())
            if value is not None:
                values[name] = (value if isinstance(field.default, str) else
                                int(value) if isinstance(field.default, int) else float(value))
        return cls(**values)
