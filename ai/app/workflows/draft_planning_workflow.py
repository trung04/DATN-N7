"""Preview-only orchestration: real tools compute schedules, explicit backend save commits business data."""
from pydantic import Field
from app.modules.recommendation.schemas import Contract
from app.modules.trip_planner.schemas import TripRequest,DayEdit
from app.modules.trip_planner.requirement_extractor import RequirementExtractor
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.database.repositories.trip_draft_repository import TripDraftRepository
from app.memory.conversation_store import ConversationStore
from app.core.exceptions import Conflict
from app.modules.semantic_search.text_utils import folded


class Explanation(Contract):
    message:str=Field(min_length=1,max_length=2000)


class DraftPlanningWorkflow:
    def __init__(self,rec):
        self.rec=rec;self.repo=TripDraftRepository(rec.store);self.memory=ConversationStore(rec.store)
    def create(self,request):
        from app.tools.tool_registry import ToolRegistry
        result=ToolRegistry(self.rec,request.user_id).execute('optimize_trip',{'request':request.model_dump(mode='json')})
        return self.repo.put(request,result)
    def edit(self,draft_id,user_id,day,edit):
        import json
        old=self.repo.get(draft_id,user_id)
        request,result=PlanningEngine(self.rec).edit({'request':json.dumps(old['request']),'result':json.dumps(old['result']),
                                                     'version':old['version']},day,edit)
        return self.repo.put(request,result,draft_id,edit.expected_version)
    def chat(self,body):
        conv=self.memory.get(body.conversation_id,body.user_id)
        draft_id=body.draft_id or conv.get('draft_plan_id')
        old=self.repo.get(draft_id,body.user_id) if draft_id else None
        context={**conv.get('draft',{}),**(old['request'] if old else {}),**body.context}
        context.pop('user_id',None)
        extracted=RequirementExtractor(self.rec.store).extract(body.message,context,body.use_llm)
        response={'conversation_id':conv['conversation_id'],'trip':None,'extraction':extracted,'preview_only':True}
        regenerate=bool(old and getattr(body,'intent',None)=='trip_planning' and not any(extracted['fields'].get(k) for k in ('remove_text','replacement_query','add_text')))
        if old and extracted['fields'].get('add_text'):
            import json
            from app.tools.tool_registry import ToolRegistry
            if body.expected_version is not None and old['version']!=body.expected_version:raise Conflict('Bản xem trước đã đổi')
            day=extracted['fields'].get('modification_day') or (1 if len(old['result']['days'])==1 else None)
            name=folded(extracted['fields']['add_text']).strip(' .,!?')
            candidates=[json.loads(row['data']) for row in self.rec.store.places()]
            candidates=[p for p in candidates if p['active'] and folded(p['city'])==folded(old['request']['city']) and folded(p['name'])==name]
            if day is None or not 1<=day<=len(old['result']['days']) or len(candidates)!=1:
                response.update(status='needs_clarification',message='Bạn nêu ngày trong chuyến đi và tên chính xác của một địa điểm để thêm nhé. Có thể tìm và chọn địa điểm ở phần lịch.')
            else:
                count=len(old['result']['days'][day-1]['activities'])
                edit=DayEdit(user_id=body.user_id,expected_version=old['version'],add_place_ids=[candidates[0]['place_id']],target_stops=min(30,count+1))
                changed=ToolRegistry(self.rec,body.user_id).execute('update_trip',{'draft_id':draft_id,'day':day,'edit':edit.model_dump(mode='json')})
                response.update(status='preview_updated',message='Đã thêm địa điểm và kiểm tra lại thời gian ngày '+str(day)+'. Chưa lưu thay đổi.',trip=changed['result'])
        elif regenerate:
            if body.expected_version is not None and old['version']!=body.expected_version:raise Conflict('Bản xem trước đã đổi')
            if extracted.get('unresolved_place_names'):
                response.update(status='needs_clarification',message='Bạn nêu rõ địa điểm bắt buộc: '+', '.join(extracted['unresolved_place_names']))
            else:
                request=TripRequest.model_validate({**extracted['draft'],'user_id':body.user_id})
                preview=self.create(request);conv['draft_plan_id']=preview['draft_id']
                response.update(status='preview_created',message=preview['result']['summary']+' Đây là bản xem trước mới; lịch đã lưu chưa thay đổi.',trip=preview['result'])
        elif old:
            if body.expected_version is not None and old['version']!=body.expected_version:raise Conflict('Bản xem trước đã đổi')
            fields=extracted['fields'];day=fields.get('modification_day');remove=folded(fields.get('remove_text') or '').strip(' .,!?')
            matches=[(d['day'],a['place_id']) for d in old['result']['days'] for a in d['activities']
                     if remove and remove in folded(a['name']) and (day is None or day==d['day'])]
            if len(matches)!=1:
                response.update(status='needs_clarification',message='Bạn nêu ngày và tên đầy đủ của địa điểm cần bỏ hoặc thay nhé. Lịch hiện tại được giữ nguyên.')
            else:
                day,pid=matches[0]
                import json
                replacement=fields.get('replacement_query')
                named=[json.loads(r['data']) for r in self.rec.store.places()]
                named=[p for p in named if p['active'] and folded(p['city'])==folded(old['request']['city'])
                       and folded(p['name']).strip(' .,!')==folded(replacement or '').strip(' .,!')]
                if len(named)>1:
                    response.update(status='needs_clarification',message='Có nhiều địa điểm trùng tên thay thế. Bạn chọn ID địa điểm cụ thể trong phần chỉnh lịch nhé.')
                else:
                    from app.tools.tool_registry import ToolRegistry
                    edit=DayEdit(user_id=body.user_id,expected_version=old['version'],remove_place_ids=[pid],
                                 add_place_ids=[named[0]['place_id']] if named else [],replacement_query=None if named else replacement)
                    changed=ToolRegistry(self.rec,body.user_id).execute('update_trip',{'draft_id':draft_id,'day':day,'edit':edit.model_dump(mode='json')})
                    response.update(status='preview_updated',message='Đã tính lại ngày '+str(day)+'. Đây là bản xem trước; bấm Lưu khi bạn đồng ý.',trip=changed['result'])
        elif extracted['missing_fields'] or extracted.get('unresolved_place_names'):
            labels={'city':'thành phố','start_date':'ngày khởi hành','days':'số ngày'}
            message='Bạn bổ sung '+', '.join(labels[k] for k in extracted['missing_fields'])+' nhé.' if extracted['missing_fields'] else ''
            if extracted.get('unresolved_place_names'):message+=' Cần xác định rõ địa điểm: '+', '.join(extracted['unresolved_place_names'])
            response.update(status='needs_clarification',message=message)
        else:
            data={**extracted['draft'],'user_id':body.user_id}
            data.setdefault('routing_provider','ors');data.setdefault('allow_estimated_routes',False)
            request=TripRequest.model_validate(data)
            preview=self.create(request);conv['draft_plan_id']=preview['draft_id']
            response.update(status='preview_created',message=preview['result']['summary']+' Đây là bản xem trước, chưa lưu lịch trình.',trip=preview['result'])
        if response.get('trip') and body.use_llm:
            import json
            from fastapi import HTTPException
            from app.llm.client import GeminiClient
            trip=response['trip']
            facts={'city':trip['city'],'days':[{'day':d['day'],'places':[a['name'] for a in d['activities']],
                    'travel_minutes':d['total_travel_minutes']} for d in trip['days']], 'warnings':trip['warnings']}
            try:
                explanation=GeminiClient().generate('Explain this computed itinerary briefly in Vietnamese. Do not invent places, times, distances, prices or optimization claims. Mention it is an unsaved preview. Never change the schedule.',json.dumps(facts,ensure_ascii=False),Explanation)
                response['message']=explanation.message
            except HTTPException:
                response['message']+=' Lời giải thích AI đang không khả dụng; lịch trình tính toán vẫn được giữ nguyên.'
        conv['draft']=extracted['draft']
        conv['messages'].extend([{'role':'user','text':body.message},{'role':'assistant','text':response['message']}])
        self.memory.save(body.user_id,conv)
        return response
