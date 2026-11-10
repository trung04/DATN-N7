"""FastAPI application factory and service lifecycle; HTTP routes live in app.api.router."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import Settings
from app.core.logging import configure_logging
from app.core.exceptions import install_exception_handlers
from app.database.sqlite import Store
from app.modules.recommendation.service import RecommendationService
from app.modules.semantic_search.image_search import ClipEmbeddingService,ImageSearchService
from app.api.router import router

logger=logging.getLogger(__name__)

def create_app(*,embedding=None,qdrant=None,db_path=None,ranking_config=None,clip_embedding=None):
    @asynccontextmanager
    async def lifespan(application):
        configure_logging()
        settings=Settings.from_env()
        owned_qdrant=None
        try:
            if embedding is None:
                from app.modules.semantic_search.embedding_service import EmbeddingService
                encoder=EmbeddingService()
            else:encoder=embedding
            if qdrant is None:
                from app.database.qdrant import QdrantService
                owned_qdrant=QdrantService()
                client=owned_qdrant.client
            else:client=qdrant
            application.state.settings=settings
            application.state.embedding=encoder
            application.state.qdrant=client
            application.state.image_search=ImageSearchService(clip_embedding or ClipEmbeddingService(),client)
            try:application.state.image_search.ensure_collection()
            except Exception:logger.warning("Image collection pending; image API will retry initialization",exc_info=True)
            application.state.recommendation=RecommendationService(Store(db_path or settings.db_path),encoder,client,
                settings.recommendation_collection,settings.vector_name,ranking_config)
            yield
        finally:
            if owned_qdrant is not None:owned_qdrant.close()
    application=FastAPI(title="AI Embedding & Tourism Recommendation Service",version="2.0.0",lifespan=lifespan)
    application.include_router(router)
    install_exception_handlers(application)
    return application

app=create_app()
