import re
from pydantic import Field
from app.modules.trip_planner.schemas import ChatRequest
from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.agents.intent_router import IntentRouter
from app.agents.general_chat_agent import GeneralChatAgent
from app.agents.travel_qa_agent import TravelQAAgent
from app.agents.place_search_agent import PlaceSearchAgent
from app.agents.trip_planner_agent import TripPlannerAgent
from app.memory.conversation_store import ConversationStore

class UnifiedChatRequest(ChatRequest):
    intent: str | None = Field(None,pattern=r"^(general_chat|travel_qa|place_search|trip_planning|replanning)$")

class ChatWorkflow:
    def __init__(self,rec):self.rec=rec
    def run(self,body):
        memory=ConversationStore(self.rec.store)
        conversation=memory.get(body.conversation_id,body.user_id)
        has_trip=bool(body.trip_id or conversation.get("trip_id"))
        intent=body.intent or IntentRouter().classify(body.message,has_trip)
        # A clarification reply (date/party/preferences) continues a planning draft; greetings remain general.
        if body.intent is None and conversation.get("draft") and not has_trip and intent=="general_chat":
            if re.search(r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})\b",body.message) or GeneralChatAgent().run(body.message)["status"]=="needs_llm":intent="trip_planning"
        if intent in ("trip_planning","replanning"):
            fields=body.model_dump(exclude={"intent"})
            # Create the shared session before handing it to the planner workflow.
            memory.save(body.user_id,conversation)
            fields["conversation_id"]=conversation["conversation_id"]
            result=TripPlannerAgent(self.rec).run(ChatRequest.model_validate(fields))
            return {"intent":intent,**result}
        if intent=="place_search":
            result=PlaceSearchAgent(self.rec).search(PlaceSearchRequest(query=body.message[:2000]))
        elif intent=="travel_qa":result=TravelQAAgent(self.rec).run(body.message[:2000])
        else:result=GeneralChatAgent().run(body.message,body.use_llm)
        conversation["messages"].extend([{"role":"user","text":body.message},{"role":"assistant","text":str(result.get("answer","Đã trả kết quả tìm kiếm"))}])
        memory.save(body.user_id,conversation)
        return {"intent":intent,"conversation_id":conversation["conversation_id"],"result":result}
