import re
from fastapi import HTTPException
from pydantic import ValidationError
from pydantic import Field
from app.modules.trip_planner.schemas import ChatRequest
from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.agents.intent_router import IntentRouter
from app.agents.general_chat_agent import GeneralChatAgent
from app.agents.travel_qa_agent import TravelQAAgent
from app.agents.place_search_agent import PlaceSearchAgent
from app.agents.trip_planner_agent import TripPlannerAgent
from app.memory.conversation_store import ConversationStore
from app.core.exceptions import Conflict,NotFound

class UnifiedChatRequest(ChatRequest):
    intent: str | None = Field(None,pattern=r"^(general_chat|travel_qa|place_search|recommendation|trip_planning|replanning|new_trip|save_trip)$")

class ChatWorkflow:
    def __init__(self,rec):self.rec=rec
    def run(self,body):
        try:return self._run(body)
        except Conflict:
            return {'conversation_id':body.conversation_id,'status':'needs_clarification','message':'Lịch đã có thay đổi. Bạn mở lại bản mới nhất rồi mình chỉnh tiếp nhé.'}
        except NotFound:
            return {'conversation_id':body.conversation_id,'status':'needs_clarification','message':'Mình chưa tìm lại được cuộc trò chuyện hoặc lịch này. Bạn mở lại lịch, hoặc bắt đầu chuyến đi mới nhé.'}
        except (ValueError,ValidationError):
            return {'conversation_id':body.conversation_id,'status':'needs_clarification','message':'Thông tin này chưa hợp lệ. Bạn kiểm tra lại ngày đi, số ngày hoặc khung giờ nhé.'}
        except HTTPException as exc:
            if exc.status_code in (401,403):raise
            return {'conversation_id':body.conversation_id,'status':'temporarily_unavailable','message':'Mình chưa xử lý được lúc này. Bạn thử gửi lại sau một chút nhé; lịch hiện tại vẫn được giữ nguyên.'}
        except (TimeoutError,ConnectionError):
            return {'conversation_id':body.conversation_id,'status':'temporarily_unavailable','message':'Mình chưa kết nối được lúc này. Bạn thử lại sau một chút nhé; lịch hiện tại vẫn được giữ.'}

    def _run(self,body):
        memory=ConversationStore(self.rec.store)
        conversation=memory.get(body.conversation_id,body.user_id)
        from app.modules.semantic_search.text_utils import folded
        text=folded(body.message)
        days=re.search(r'\b(\d+)\s+ngay\b',text)
        if days and not 1<=int(days[1])<=14:
            return {'conversation_id':conversation['conversation_id'],'status':'needs_clarification','message':'Số ngày cần từ 1 đến 14. Bạn muốn đi mấy ngày nhé?'}
        hours=re.search(r'\b(\d{1,2})\s*h\s*[-–—]\s*(\d{1,2})\s*h\b',body.message,re.I)
        if hours and int(hours[1])>=int(hours[2]):
            return {'conversation_id':conversation['conversation_id'],'status':'needs_clarification','message':'Khung giờ này qua đêm. Bạn chọn giờ bắt đầu và kết thúc trong cùng ngày giúp mình nhé?'}
        if re.search(r'\b(?:api key|api_key|ors_api_key|gemini_api_key|mat khau|secret)\b',body.message.casefold()) or 'api key' in text:
            return {'conversation_id':conversation['conversation_id'],'status':'answered','result':{'answer':'Mình không thể cung cấp khóa truy cập hoặc thông tin bí mật.'}}
        has_trip=bool(body.trip_id or body.draft_id or conversation.get("trip_id") or conversation.get('draft_plan_id'))
        intent=body.intent or IntentRouter().classify(body.message,has_trip)
        understanding=None
        direct=GeneralChatAgent().run(body.message)
        if conversation.get('draft') and re.fullmatch(r'\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4}',body.message.strip()):
            direct={'status':'needs_llm','answer':''}
        pending=conversation.get('pending_fields',[])
        if re.search(r'\b(?:bat dau|tao)\s+(?:mot\s+)?chuyen di moi\b',text):
            intent='new_trip'
        elif re.fullmatch(r'(?:hay |giup toi )?luu (?:lai )?lich trinh(?: vua tao| nay| giup toi| cho toi)?',text):
            intent='save_trip'
        elif body.preview_only and pending and pending[0] in ('days','party_size') and body.message.strip().isdigit():
            from app.agents.chat_understanding import Understanding
            understanding=Understanding(intent='trip_planning',fields={pending[0]:int(body.message.strip())})
            intent='trip_planning'
        elif direct['status']=='answered':
            intent='general_chat'
        elif body.use_llm:
            from app.agents.chat_understanding import understand
            understanding=understand(body.message,conversation,has_trip)
            intent=body.intent or understanding.intent
            if intent=='replanning' and not any(getattr(understanding.fields,k) for k in ('add_text','remove_text','replacement_query')) and any(getattr(understanding.fields,k) is not None for k in ('city','days','start_date','transport','daily_window','preferences','party_size','fill_day','max_daily_activity_minutes')):
                intent='trip_planning'
        elif body.intent is None and conversation.get('draft'):
            from app.modules.semantic_search.text_utils import folded
            text=folded(body.message)
            if intent=='general_chat' and (re.search(r'\b(ngay|nguoi|gio|di bo|o to|xe dap|mac dinh|xac nhan|doi|chuyen|thich)\b',text) or re.search(r'\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2}',body.message)):intent='trip_planning'
        if intent=='new_trip':
            fresh=memory.get(None,body.user_id);memory.save(body.user_id,fresh)
            return {'conversation_id':fresh['conversation_id'],'status':'new_trip','trip':None,'message':'Mình bắt đầu chuyến đi mới nhé. Bạn muốn đến đâu?'}
        if intent=='recommendation':
            from app.modules.recommendation.schemas import RecommendationRequest
            from app.tools.tool_registry import ToolRegistry
            prefs=(understanding.fields.preferences if understanding else None) or conversation.get('draft',{}).get('preferences') or self.rec.store.preferences(body.user_id)
            if not prefs and not self.rec.store.interactions(body.user_id):
                return {'conversation_id':conversation['conversation_id'],'status':'needs_clarification','message':'Bạn thích trải nghiệm nào, chẳng hạn thiên nhiên, văn hóa hay ẩm thực?'}
            request=RecommendationRequest(user_id=body.user_id,preferences=prefs or None,
                mode='personalized_mmr' if self.rec.store.interactions(body.user_id) else 'content_rating',
                city=(understanding.fields.city if understanding else None) or conversation.get('draft',{}).get('city'))
            result=ToolRegistry(self.rec,body.user_id).execute('recommend',{'request':request.model_dump(mode='json')})
            result['answer']=f"Mình tìm được {result['total']} gợi ý theo sở thích của bạn."
            return {'conversation_id':conversation['conversation_id'],'intent':intent,'result':result}
        if intent=='save_trip':
            from app.database.repositories.trip_draft_repository import TripDraftRepository
            from app.database.repositories.demo_trip_repository import DemoTripRepository
            draft_id=body.draft_id or conversation.get('draft_plan_id')
            if not draft_id:return {'conversation_id':conversation['conversation_id'],'status':'needs_clarification','message':'Bạn chưa có lịch trình để lưu. Mình cùng tạo lịch trước nhé?'}
            draft=TripDraftRepository(self.rec.store).get(draft_id,body.user_id)
            if body.expected_version is not None and body.expected_version!=draft['version']:raise Conflict('stale draft')
            known=conversation.get('saved_trip',{}) if conversation.get('saved_trip',{}).get('draft_id')==draft_id else {}
            saved=DemoTripRepository(self.rec.store).save(user_id=body.user_id,draft_id=draft_id,expected_draft_version=draft['version'],name=draft['result']['city'],trip_id=known.get('id'),expected_version=known.get('version'))
            metadata={k:saved[k] for k in ('id','name','version')}
            conversation['saved_trip']={**metadata,'draft_id':draft_id};memory.save(body.user_id,conversation)
            return {'conversation_id':conversation['conversation_id'],'status':'saved','message':'Mình đã lưu lịch trình cho bạn.','saved_trip_id':saved['id'],'saved_trip':metadata}
        if intent in ("trip_planning","replanning"):
            if body.preview_only:
                from app.workflows.draft_planning_workflow import DraftPlanningWorkflow
                memory.save(body.user_id,conversation)
                body=body.model_copy(update={'conversation_id':conversation['conversation_id'],'intent':intent})
                return {'intent':intent,**DraftPlanningWorkflow(self.rec).chat(body,understanding=understanding)}
            fields=body.model_dump(exclude={"intent"})
            # Create the shared session before handing it to the planner workflow.
            memory.save(body.user_id,conversation)
            fields["conversation_id"]=conversation["conversation_id"]
            result=TripPlannerAgent(self.rec).run(ChatRequest.model_validate(fields),understanding=understanding)
            return {"intent":intent,**result}
        if intent=="place_search":
            city=understanding.fields.city or conversation.get('draft',{}).get('city') if understanding else None
            result=PlaceSearchAgent(self.rec).search(PlaceSearchRequest(query=body.message[:2000],filters={'city':city} if city else {}))
            result['answer']=f"Mình tìm được {len(result['results'])} địa điểm trong dữ liệu hiện có." if result['results'] else 'Mình chưa tìm thấy địa điểm phù hợp trong dữ liệu hiện có. Bạn thử đổi khu vực hoặc tiêu chí nhé?'
            conversation['recent_places']=[{'place_id':p['place_id'],'name':p['name'][:200]} for p in result['results'][:3]]
        elif intent=="travel_qa":
            from app.modules.semantic_search.text_utils import folded
            names=understanding.fields.required_place_names or [] if understanding else []
            known=[p for p in conversation.get('recent_places',[]) if folded(p['name']) in {folded(n) for n in names}]
            query=' '.join(names+[body.message]) if names else body.message
            result=TravelQAAgent(self.rec).run(query[:2000],place_id=known[0]['place_id'] if len(known)==1 else None,requested_names=names)
            if result.get('facts'):conversation['recent_places']=[{'place_id':p['place_id'],'name':p['name'][:200]} for p in result['facts'][:3]]
        else:result={'status':'answered','answer':understanding.answer} if understanding and understanding.answer else direct
        conversation["messages"].extend([{"role":"user","text":body.message},{"role":"assistant","text":str(result.get("answer","Đã trả kết quả tìm kiếm"))}])
        memory.save(body.user_id,conversation)
        return {"intent":intent,"conversation_id":conversation["conversation_id"],"result":result}
