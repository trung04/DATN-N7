from fastapi import APIRouter,Depends,Query
from pydantic import Field
from app.core.auth import authorize
from app.api.dependencies import service
from app.core.exceptions import Conflict
from app.modules.recommendation.schemas import Contract,Identifier
from .schemas import TripRequest
from app.database.repositories.demo_trip_repository import DemoTripRepository
from app.database.repositories.trip_draft_repository import TripDraftRepository
from app.workflows.draft_planning_workflow import DraftPlanningWorkflow

router=APIRouter(prefix='/api/v1',tags=['AI demo saved itineraries'],dependencies=[Depends(authorize)])

class DemoSave(Contract):
    user_id:Identifier
    draft_id:Identifier
    expected_draft_version:int=Field(ge=1)
    name:str=Field(min_length=1,max_length=200)
    trip_id:Identifier|None=None
    expected_version:int|None=Field(None,ge=1)

class PreviewVersion(Contract):
    user_id:Identifier
    expected_version:int=Field(ge=1)

@router.post('/demo/trips',status_code=201)
def save_demo(body:DemoSave,svc=Depends(service)):
    return DemoTripRepository(svc.store).save(**body.model_dump())

@router.get('/demo/trips')
def list_demo(user_id:Identifier,svc=Depends(service)):
    return {'items':DemoTripRepository(svc.store).list(user_id),'storage':'ai_demo'}

@router.get('/demo/trips/{trip_id}')
def get_demo(trip_id:Identifier,user_id:Identifier,svc=Depends(service)):
    return DemoTripRepository(svc.store).get(trip_id,user_id)

@router.delete('/demo/trips/{trip_id}',status_code=204)
def delete_demo(trip_id:Identifier,user_id:Identifier,expected_version:int=Query(ge=1),svc=Depends(service)):
    DemoTripRepository(svc.store).delete(trip_id,user_id,expected_version)

@router.post('/demo/trips/{trip_id}/preview')
def restore_demo(trip_id:Identifier,body:PreviewVersion,svc=Depends(service)):
    saved=DemoTripRepository(svc.store).get(trip_id,body.user_id)
    if saved['version']!=body.expected_version:raise Conflict('Lịch đã lưu thay đổi; tải lại')
    return TripDraftRepository(svc.store).put(TripRequest.model_validate(saved['request']),saved['result'])

@router.post('/trips/previews/{draft_id}/reoptimize')
def reoptimize_demo(draft_id:Identifier,body:PreviewVersion,svc=Depends(service)):
    repository=TripDraftRepository(svc.store);old=repository.get(draft_id,body.user_id)
    if old['version']!=body.expected_version:raise Conflict('Bản xem trước đã đổi')
    from .itinerary_optimizer import PlanningEngine
    request=TripRequest.model_validate(old['request']);result=PlanningEngine(svc).build(request)
    return repository.put(request,result,draft_id,body.expected_version)
