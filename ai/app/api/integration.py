"""Backend-facing adapters for the existing frontend contracts.

These endpoints require the AI service credential. Backend callers must bind
userId from their authenticated session; never ship the service key to a browser.
The original /search/places, /recommendations and /chat contracts stay unchanged.
"""
import json
from typing import Literal
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from app.core.auth import authorize
from app.api.dependencies import service
from app.modules.recommendation.schemas import Contract, Identifier, RecommendationRequest, RecommendationResponse, Text
from app.modules.semantic_search.schemas import PlaceSearchRequest, PlaceSearchResponse
from app.agents.place_search_agent import PlaceSearchAgent
from app.workflows.chat_workflow import ChatWorkflow, UnifiedChatRequest

router=APIRouter(prefix='/api/v1/ai',tags=['Backend integration'],dependencies=[Depends(authorize)])


class FrontendRecommendationRequest(Contract):
    query: str | None = Field(None,min_length=1,max_length=2000)
    userId: Identifier | None = None
    preferences: list[Text] | None = Field(None,max_length=30)
    city: Text | None = None
    placeType: Literal['Hotel','Restaurant','Attraction'] | None = None
    limit: int = Field(12,ge=1,le=100)
    usePreference: bool = True


class FrontendRecommendationItem(Contract):
    id: str
    type: Literal['destination','hotel','restaurant']
    name: str
    city: str
    price: float | None
    tags: list[str]
    description: str
    score: float
    reason: str
    image: str | None = None


class FrontendChatRequest(Contract):
    userId: Identifier
    message: str = Field(min_length=1,max_length=4000)
    conversationId: Identifier | None = None
    draftId: Identifier | None = None
    expectedVersion: int | None = Field(None,ge=1)
    context: dict = Field(default_factory=dict)
    useLlm: bool = True


@router.post('/search',response_model=PlaceSearchResponse)
def search(body:PlaceSearchRequest,svc=Depends(service)):
    return PlaceSearchAgent(svc).search(body)


def recommendation_request(body):
    personalized=bool(body.userId and body.usePreference)
    return RecommendationRequest(user_id=body.userId or 'anonymous',query=body.query,city=body.city,
        preferences=body.preferences if body.preferences is not None else None if personalized else [],
        place_type=body.placeType,limit=body.limit,mode='personalized_mmr' if personalized else 'content_rating',
        refresh_variety=personalized)


@router.post('/recommendations/detailed',response_model=RecommendationResponse)
def detailed_recommendations(body:FrontendRecommendationRequest,svc=Depends(service)):
    return svc.recommend(recommendation_request(body))


@router.post('/recommendations',response_model=list[FrontendRecommendationItem])
def frontend_recommendations(body:FrontendRecommendationRequest,svc=Depends(service)):
    response=svc.recommend(recommendation_request(body))
    rows={r['id']:json.loads(r['data']) for r in svc.store.places()}
    result=[]
    for item in response['recommendations']:
        place=rows.get(item['place_id'],{})
        price=place.get('price')
        # Missing price stays null, never turns into a fabricated free admission.
        price=price if isinstance(price,(int,float)) and not isinstance(price,bool) else None
        result.append({'id':item['place_id'],'type':{'Hotel':'hotel','Restaurant':'restaurant'}.get(item['place_type'],'destination'),
            'name':item['name'],'city':item['city'],'price':price,'tags':place.get('tags',[]),
            'description':place.get('description') or '', 'score':item['score'],'reason':'; '.join(item['reasons']),
            'image':item.get('image_url')})
    return result


@router.post('/chat')
def frontend_chat(body:FrontendChatRequest,request:Request):
    # Preview only. Saving still requires a separately authorized backend action.
    translated=UnifiedChatRequest(user_id=body.userId,message=body.message,conversation_id=body.conversationId,
        draft_id=body.draftId,expected_version=body.expectedVersion,context=body.context,use_llm=body.useLlm,preview_only=True)
    return ChatWorkflow(request.app.state.recommendation).run(translated)
