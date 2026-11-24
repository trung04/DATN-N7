from app.core.auth import authorize
from app.api.dependencies import service
from fastapi import APIRouter, Depends, Query
from .schemas import Identifier, RecommendationRequest, RecommendationResponse, UserPreferences, InteractionEvent


router = APIRouter(prefix="/api/v1", tags=["Recommendation"], dependencies=[Depends(authorize)])


@router.get("/users/{user_id}/interactions")
def interaction_history(user_id: Identifier, limit: int = Query(100, ge=1, le=200),
                        offset: int = Query(0, ge=0), svc=Depends(service)):
    import json
    from .personalized import aggregate_signals
    events = svc.store.interactions(user_id)
    places = {r['id']: json.loads(r['data']) for r in svc.store.places()}
    positive, negative = aggregate_signals(events)
    rows = [{**e, "place_name": places.get(e['place_id'], {}).get('name', e['place_id'])}
            for e in reversed(events)]
    return {"user_id": user_id, "total": len(events), "items": rows[offset:offset+limit],
            "positive_place_weights": positive, "negative_place_ids": sorted(negative)}


@router.post("/users/{user_id}/interactions")
def record_interaction(user_id: Identifier, body: InteractionEvent, svc=Depends(service)):
    with svc.lock:
        created = svc.store.save_interaction(user_id, body)
    return {"event_id": body.event_id, "created": created}


@router.delete("/users/{user_id}/interactions")
def clear_interactions(user_id: Identifier, svc=Depends(service)):
    with svc.lock:
        deleted = svc.store.clear_interactions(user_id)
    return {"user_id": user_id, "deleted": deleted}



@router.put("/users/{user_id}/preferences")
def save_preferences(user_id: Identifier, body: UserPreferences, svc=Depends(service)):
    svc.store.set_preferences(user_id, body.preferences)
    return {"user_id": user_id, "preferences": body.preferences}


@router.get("/users/{user_id}/preferences")
def get_preferences(user_id: Identifier, svc=Depends(service)):
    return {"user_id": user_id, "preferences": svc.store.preferences(user_id)}


@router.post("/recommendations", response_model=RecommendationResponse)
def recommendations(body: RecommendationRequest, svc=Depends(service)):
    return svc.recommend(body)


@router.get("/recommendations/{request_id}", response_model=RecommendationResponse)
def get_recommendation(request_id: Identifier, svc=Depends(service)):
    return svc.store.recommendation(request_id)


@router.post("/recommendation/reindex")
def reindex(limit: int = Query(100, ge=1, le=100), svc=Depends(service)):
    return svc.reindex(limit)


@router.get("/recommendation/status")
def status(svc=Depends(service)):
    return svc.status()
