from app.core.auth import authorize
from app.api.dependencies import service
import os
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from .schemas import (Identifier, ImpressionData, InteractionData, PlaceBatch, PlaceData,
                      PlaceEmbeddingResponse, PlaceEmbeddingBatchResponse, RecommendationRequest,
                      RecommendationResponse, ReviewBatch, UserPreferences)


router = APIRouter(prefix="/api/v1", tags=["Recommendation"], dependencies=[Depends(authorize)])


@router.put("/users/{user_id}/preferences")
def save_preferences(user_id: Identifier, body: UserPreferences, svc=Depends(service)):
    svc.store.set_preferences(user_id, body.preferences)
    return {"user_id": user_id, "preferences": body.preferences}


@router.get("/users/{user_id}/preferences")
def get_preferences(user_id: Identifier, svc=Depends(service)):
    return {"user_id": user_id, "preferences": svc.store.preferences(user_id)}


@router.post("/interactions")
def interaction(body: InteractionData, svc=Depends(service)):
    created = svc.store.add_event(body)
    return {"event_id": body.event_id, "created": created}


@router.post("/impressions")
def visible_impression(body: ImpressionData, svc=Depends(service)):
    """Client confirms which delivered items actually became visible."""
    return {"event_id": body.event_id, "created": svc.store.add_exposure(body)}


@router.post("/recommendations", response_model=RecommendationResponse)
def recommendations(body: RecommendationRequest, svc=Depends(service)):
    return svc.recommend(body)


@router.get("/recommendations/{request_id}", response_model=RecommendationResponse)
def impression(request_id: Identifier, svc=Depends(service)):
    return svc.store.impression(request_id)


@router.post("/recommendation/reindex")
def reindex(limit: int = Query(100, ge=1, le=100), svc=Depends(service)):
    return svc.reindex(limit)


@router.get("/recommendation/status")
def status(svc=Depends(service)):
    return svc.status()
