"""Whitelist + Pydantic contracts; caller identity is supplied by the workflow, never an LLM."""
from pydantic import Field
from app.core.exceptions import Conflict
from app.modules.recommendation.schemas import Contract,Identifier,RecommendationRequest
from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.modules.trip_planner.schemas import TripRequest,RouteMatrixRequest
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
class ToolCall(Contract):
    name: str = Field(min_length=1,max_length=80)
    args: dict

CONTRACTS={"semantic_search":SearchArguments,"recommend":RecommendationArguments,
    "place_details":DetailsArguments,"route_matrix":RoutingArguments,"optimize_trip":OptimizationArguments}


class ToolRegistry:
    def __init__(self,rec,user_id=None):
        self.rec,self.user_id=rec,user_id

    def execute(self,name,args):
        if name not in CONTRACTS:
            raise ValueError("Tool không được phép: "+name)
        parsed=CONTRACTS[name].model_validate(args)
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
