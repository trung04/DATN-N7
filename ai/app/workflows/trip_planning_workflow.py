import json
from app.core.exceptions import Conflict
from app.modules.semantic_search.text_utils import folded
from app.modules.trip_planner.schemas import TripRequest,DayEdit
from app.modules.trip_planner.requirement_extractor import RequirementExtractor
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.database.repositories.trip_repository import TripRepository
from app.memory.conversation_store import ConversationStore
from app.memory.trip_context import merge_context
from .replanning_workflow import ReplanningWorkflow

class TripPlanningWorkflow:
    def __init__(self,rec):
        self.rec=rec
        self.repo=TripRepository(rec.store)
        self.conversations=ConversationStore(rec.store)
        self.engine=PlanningEngine(rec)

    def create(self,request):
        from app.tools.tool_registry import ToolRegistry
        result=ToolRegistry(self.rec,request.user_id).execute("optimize_trip",{"request":request.model_dump(mode="json")})
        return self.repo.save(request,result)

    def chat(self,body):
        rec,repo,engine=self.rec,self.repo,self.engine
        conversation=self.conversations.get(body.conversation_id,body.user_id)
        trip_id=body.trip_id or conversation.get("trip_id")
        stored=repo.get(trip_id,body.user_id) if trip_id else None
        context=merge_context(conversation,body.context,stored)
        extracted=RequirementExtractor(rec.store).extract(body.message,context,body.use_llm)
        response={"conversation_id":conversation["conversation_id"],"extraction":extracted,"trip":None}
        if trip_id:
            conversation["trip_id"]=trip_id
            current=json.loads(stored["result"])
            fields=extracted["fields"]
            day=fields.get("modification_day")
            if body.expected_version is not None and body.expected_version!=stored["version"]:
                raise Conflict("expected_version cũ; tải lại lịch trình")
            if not day or not fields.get("remove_text") or day>len(current["days"]):
                response.update(status="needs_clarification",message="Hãy nêu ngày và tên địa điểm cần bỏ/thay; hoặc dùng PATCH /trips/{id}/days/{day} để sửa chính xác")
            else:
                remove=folded(fields["remove_text"])
                matches=[]
                for activity in current["days"][day-1]["activities"]:
                    p=json.loads(rec.store.place(activity["place_id"])["data"])
                    if remove in folded(p["name"]+" "+" ".join(p["categories"])):
                        matches.append(p["place_id"])
                if len(matches)!=1:
                    response.update(status="needs_clarification",message="Chưa xác định duy nhất địa điểm cần bỏ; hãy nêu tên đầy đủ hoặc dùng place_id qua API chỉnh ngày")
                else:
                    edit=DayEdit(user_id=body.user_id,expected_version=stored["version"],remove_place_ids=matches,
                        replacement_query=fields.get("replacement_query"))
                    result=ReplanningWorkflow(rec).run(trip_id,day,edit)
                    response.update(status="updated",message=result["summary"],trip=result)
        elif extracted["missing_fields"]:
            labels={"city":"thành phố","start_date":"ngày khởi hành (YYYY-MM-DD)","days":"số ngày"}
            response.update(status="needs_clarification",message="Bạn bổ sung "+", ".join(labels[k] for k in extracted["missing_fields"])+" nhé.")
        else:
            req=TripRequest.model_validate({**extracted["draft"],"user_id":body.user_id})
            result=self.create(req)
            conversation["trip_id"]=result["trip_id"]
            response.update(status="created",message=result["summary"],trip=result)
        conversation["draft"]=extracted["draft"]
        conversation["messages"].extend([{"role":"user","text":body.message},{"role":"assistant","text":response["message"]}])
        self.conversations.save(body.user_id,conversation)
        return response
