import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from app.modules.semantic_search.text_search import folded
from app.core.auth import authorize
from app.modules.recommendation.schemas import Identifier
from app.database.sqlite import Conflict
from .schemas import TripRequest, TripResponse, DayEdit, ExtractRequest, ChatRequest, RouteMatrixRequest
from .itinerary_optimizer import PlanningEngine
from app.database.repositories.trip_repository import TripRepository
from .requirement_extractor import RequirementExtractor


router=APIRouter(prefix="/api/v1",tags=["AI Trip Planner"],dependencies=[Depends(authorize)])


def components(request: Request):
    rec=request.app.state.recommendation
    return rec,TripRepository(rec.store),PlanningEngine(rec)


@router.post("/trips/extract")
def extract(body: ExtractRequest, services=Depends(components)):
    rec,_,_=services
    return RequirementExtractor(rec.store).extract(body.message,body.context,body.use_llm)


@router.post("/trips/route-matrix")
def route_matrix(body: RouteMatrixRequest, services=Depends(components)):
    _,_,engine=services
    return engine.routing.build([p.model_dump() for p in body.locations],body.transport,body.allow_estimates)


@router.post("/trips",status_code=201,response_model=TripResponse,response_model_exclude_unset=True)
def create_trip(body: TripRequest, services=Depends(components)):
    _,repo,engine=services
    from app.workflows.trip_planning_workflow import TripPlanningWorkflow
    return TripPlanningWorkflow(services[0]).create(body)


@router.get("/trips/{trip_id}",response_model=TripResponse,response_model_exclude_unset=True)
def get_trip(trip_id: Identifier,user_id: Identifier=Query(...),services=Depends(components)):
    _,repo,_=services
    return json.loads(repo.get(trip_id,user_id)["result"])


@router.patch("/trips/{trip_id}/days/{day_number}",response_model=TripResponse,response_model_exclude_unset=True)
def edit_day(trip_id: Identifier,day_number: int,body: DayEdit,services=Depends(components)):
    _,repo,engine=services
    stored=repo.get(trip_id,body.user_id)
    from app.workflows.replanning_workflow import ReplanningWorkflow
    return ReplanningWorkflow(services[0]).run(trip_id,day_number,body)


@router.get("/trips/{trip_id}/validation")
def validate_trip(trip_id: Identifier,user_id: Identifier=Query(...),services=Depends(components)):
    from .schedule_validator import validate_stored_trip
    rec,repo,_=services
    return validate_stored_trip(rec,repo.get(trip_id,user_id),trip_id)

@router.post("/trip-planner/chat")
def planner_chat(body: ChatRequest,services=Depends(components)):
    from app.agents.trip_planner_agent import TripPlannerAgent
    return TripPlannerAgent(services[0]).run(body)
