"""Whitelist + Pydantic contracts; caller identity is supplied by the workflow, never an LLM."""
from pydantic import Field
from app.core.exceptions import Conflict
from app.modules.recommendation.schemas import Contract,Identifier,RecommendationRequest
from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.modules.trip_planner.schemas import TripRequest,RouteMatrixRequest,DayEdit,Coordinate
from .semantic_search_tool import semantic_search
from .recommendation_tool import recommend
from .place_details_tool import place_details
from .routing_tool import route_matrix
from .optimization_tool import optimize_trip


class SearchArguments(Contract):
    request: PlaceSearchRequest
class RecommendationArguments(Contract):
    request: RecommendationRequest
class DetailsArguments(Contract):
    place_id: Identifier
class RoutingArguments(Contract):
    request: RouteMatrixRequest
class OptimizationArguments(Contract):
    request: TripRequest
class MatrixPoint(Coordinate):
    place_id: Identifier | None = None
class MatrixArguments(Contract):
    locations: list[MatrixPoint] = Field(min_length=1,max_length=82)
    transport: str = Field(default='driving',pattern='^(driving|walking|cycling)$')
class TripDetailsArguments(Contract):
    trip_id: Identifier
    saved: bool = False
class SaveTripArguments(Contract):
    draft_id: Identifier
    name: str = Field(min_length=1,max_length=200)
    itinerary_id: Identifier | None = None
    expected_version: int | None = Field(None,ge=1)
class UpdateTripArguments(Contract):
    draft_id: Identifier
    day: int = Field(ge=1,le=14)
    edit: DayEdit
class ToolCall(Contract):
    name: str = Field(min_length=1,max_length=80)
    args: dict

CONTRACTS={"semantic_search":SearchArguments,"recommend":RecommendationArguments,
    "place_details":DetailsArguments,"route_matrix":RoutingArguments,"optimize_trip":OptimizationArguments,
    'search_places':SearchArguments,'recommend_places':RecommendationArguments,'get_route_matrix':MatrixArguments,
    'get_trip_details':TripDetailsArguments,'save_trip':SaveTripArguments,'update_trip':UpdateTripArguments}


class ToolRegistry:
    def __init__(self,rec,user_id=None,save_authorized=False):
        self.rec,self.user_id=rec,user_id
        self.save_authorized=save_authorized

    def execute(self,name,args):
        name={'search_places':'semantic_search','recommend_places':'recommend'}.get(name,name)
        if name not in CONTRACTS:
            raise ValueError("Tool không được phép: "+name)
        parsed=CONTRACTS[name].model_validate(args)
        if name in ('get_trip_details','save_trip','update_trip'):
            if not self.user_id:raise Conflict('Authenticated caller required')
            from app.database.repositories.trip_draft_repository import TripDraftRepository
            from .trip_storage_tool import saved_trip_call
            if name=='get_trip_details':
                return saved_trip_call('details',self.user_id,{'itineraryId':parsed.trip_id}) if parsed.saved else TripDraftRepository(self.rec.store).get(parsed.trip_id,self.user_id)
            if name=='save_trip':
                if not self.save_authorized:raise Conflict('Explicit save confirmation required outside LLM arguments')
                return saved_trip_call('save',self.user_id,{'draftId':parsed.draft_id,'name':parsed.name,
                    **({'itineraryId':parsed.itinerary_id} if parsed.itinerary_id else {}),
                    **({'expectedVersion':parsed.expected_version} if parsed.expected_version else {})})
            if parsed.edit.user_id!=self.user_id:raise Conflict('Tool cannot change caller identity')
            from app.workflows.draft_planning_workflow import DraftPlanningWorkflow
            return DraftPlanningWorkflow(self.rec).edit(parsed.draft_id,self.user_id,parsed.day,parsed.edit)
        if name=='get_route_matrix':
            from app.modules.trip_planner.ors_matrix import OrsMatrix
            points=[point.model_dump(exclude_none=True) for point in parsed.locations]
            return OrsMatrix().build(points,parsed.transport)
        request=getattr(parsed,"request",None)
        if name in ("recommend","optimize_trip"):
            if not self.user_id or request.user_id!=self.user_id:
                raise Conflict("Tool không được thay đổi danh tính người dùng")
        if name=="semantic_search":return semantic_search(self.rec,request)
        if name=="recommend":return recommend(self.rec,request)
        if name=="place_details":return place_details(self.rec,parsed.place_id)
        if name=="route_matrix":return route_matrix(request)
        return optimize_trip(self.rec,request)

    def execute_call(self,call):
        parsed=ToolCall.model_validate(call)
        return self.execute(parsed.name,parsed.args)
