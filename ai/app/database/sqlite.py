import sqlite3
from pathlib import Path
from contextlib import contextmanager
from .repositories.place_repository import PlaceRepository
from .repositories.recommendation_repository import RecommendationRepository
from .repositories.user_repository import UserRepository

class Store(PlaceRepository, RecommendationRepository, UserRepository):
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = str(path)
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS places (
                    id TEXT PRIMARY KEY, data TEXT NOT NULL, vector TEXT,
                    content_hash TEXT, model TEXT, indexed INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS reviews (
                    id TEXT PRIMARY KEY, place_id TEXT NOT NULL REFERENCES places(id), data TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS review_place ON reviews(place_id);
                CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, preferences TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS impressions (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, occurred_at TEXT NOT NULL, data TEXT NOT NULL);
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()
