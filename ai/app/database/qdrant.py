from app.core.config import env
import os
from pathlib import Path
from dotenv import load_dotenv 
from qdrant_client import QdrantClient


class QdrantService:
    def __init__(self):
        
        self.collection_name = env("QDRANT_COLLECTION_NAME","documents_bge_m3")

        if not self.collection_name:
            raise ValueError("Chưa cấu hình QDRANT_COLLECTION trong .env")

        self.client = QdrantClient(
            url = env("QDRANT_URL","http://localhost:6333"),
            timeout = 30
        )

    def get_collection_info(self):
        info = self.client.get_collection(self.collection_name)

        return {
            "collection_name": self.collection_name,
            "status": info.status,
            "points_count": info.points_count,
            "vectors": info.config.params.vectors,
        }

    def close(self):
        self.client.close()
