"""Rule extraction plus an opt-in Gemini structured-output adapter (no place generation)."""
import json
import re
from typing import Literal
from datetime import date
from pydantic import Field
from app.modules.semantic_search.text_utils import folded, negative_before
from app.modules.recommendation.schemas import Contract, Text
from .schemas import TripRequest,TimeWindow,Coordinate


class RequirementFields(Contract):
    city: Text | None = None
    start_date: date | None = None
    days: int | None = Field(None,ge=1,le=14)
    party_size: int | None = Field(None,ge=1,le=100)
    preferences: list[Text] | None = Field(None,max_length=30)
    stops_per_day: int | None = Field(None,ge=1,le=30)
    daily_window: TimeWindow | None = None
    max_daily_activity_minutes: int | None = Field(None,ge=30,le=480)
    breaks: list[TimeWindow] | None = Field(None,max_length=5)
    start_location: Coordinate | None = None
    end_location: Coordinate | None = None
    required_place_names: list[Text] | None = Field(None,max_length=30)
    excluded_place_names: list[Text] | None = Field(None,max_length=30)
    transport: Literal["driving","walking","cycling"] | None = None
    modification_day: int | None = Field(None,ge=1,le=14)
    remove_text: str | None = Field(None,max_length=300)
    add_text: str | None = Field(None,max_length=300)
    replacement_query: str | None = Field(None,max_length=2000)


class RequirementExtractor:
    def __init__(self, store):
        self.store=store

    def llm(self,message,context):
        from app.llm.client import GeminiClient
        return GeminiClient().extract(message,context,RequirementFields)

    def extract(self,message,context=None,use_llm=False):
        text=folded(message)
        warnings=[]
        fields={}
        cities={json.loads(r["data"])["city"] for r in self.store.places()}|{"Đà Nẵng","Hội An","Huế","Nha Trang","Hà Nội","Đà Lạt","Phú Quốc","Hồ Chí Minh"}
        found=[city for city in cities if re.search(r"\b"+re.escape(folded(city))+r"\b",text)]
        if len(found)==1:
            fields["city"]=found[0]
        elif len(found)>1:
            warnings.append("Chuyến đi nhiều thành phố chưa hỗ trợ; hãy chọn một city")
        if match:=re.search(r"\b(\d{1,2})\s+ngay\b",text):
            fields["days"]=int(match[1])
        if match:=re.search(r"\b(\d{1,2})\s+nguoi\b",text):
            fields["party_size"]=int(match[1])
        if match:=re.search(r"\b(\d{4}-\d{2}-\d{2})\b",message):
            try: fields["start_date"]=date.fromisoformat(match[1]).isoformat()
            except ValueError: warnings.append("Ngày khởi hành không hợp lệ")
        elif match:=re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b",message):
            try: fields["start_date"]=date(int(match[3]),int(match[2]),int(match[1])).isoformat()
            except ValueError: warnings.append("Ngày khởi hành không hợp lệ")
        match=re.search(r"(?:moi ngay.*?)(\d)(?:\s+(\d))?\s+(?:dia diem|diem)",text)
        match=match or re.search(r"\b(\d)(?:\s+(\d))?\s+(?:dia diem|diem)(?:\s+moi)?\s+ngay",text)
        if match:
            fields["stops_per_day"]=int(match[2] or match[1])
        preferences=[]
        for value in ("biển","hoàng hôn","hải sản","cà phê","ẩm thực","thiên nhiên","văn hóa","bảo tàng","nghỉ dưỡng"):
            if (m:=re.search(r"\b"+re.escape(folded(value))+r"\b",text)) and not negative_before(text,m.start()):
                preferences.append(value)
        if preferences:
            fields["preferences"]=preferences
        for phrase,mode in (("di bo","walking"),("xe dap","cycling"),("o to","driving")):
            if (m:=re.search(r"\b"+phrase+r"\b",text)) and not negative_before(text,m.start()):
                fields["transport"]=mode
        if match:=re.search(r"\bngay\s+(?:thu\s+)?(\d{1,2}|hai|ba|tu|nam|sau|bay|mot)\b",text):
            numbers={"mot":1,"hai":2,"ba":3,"tu":4,"nam":5,"sau":6,"bay":7}
            fields["modification_day"]=int(match[1]) if match[1].isdigit() else numbers[match[1]]
        if match:=re.search(r"\b(?:bo|xoa)\s+(.+?)(?:\s+di\b|\s+thay\b|$)",text):
            fields["remove_text"]=match[1].strip()
        if match:=re.search(r'\bthem\s+(.+?)(?:\s+vao\s+ngay\b.*|$)',text):fields['add_text']=match[1].strip(' .,!?')
        if match:=re.search(r"\bthay(?:\s+bang)?\s+(.+)$",text):
            fields["replacement_query"]=match[1].strip()
        if match:=re.search(r'\b(?:doi|thay)\s+(.+?)\s+(?:sang|bang)\s+(.+)$',text):
            fields['remove_text']=match[1].strip()
            fields['replacement_query']=match[2].strip()
        if use_llm:
            fields.update(self.llm(message,context or {}))
        if not re.search(r'\b(bo|thay|doi|xoa|them)\b',text):
            for name in ('modification_day','remove_text','replacement_query','add_text'):fields.pop(name,None)
        if (match:=re.search(r'(?:moi ngay|mot ngay|ngay)\s+(?:khoang|toi da)?\s*(\d{1,2})\s*(?:tieng|gio)\s*(?:hoat dong|tham quan)',text)):
            fields['max_daily_activity_minutes']=int(match[1])*60
        if (match:=re.search(r'(?:tham quan|hoat dong)\s*(?:khoang|toi da)?\s*(\d{1,2})\s*(?:tieng|gio)',text)):
            fields['max_daily_activity_minutes']=int(match[1])*60
        if (match:=re.search(r'(?:tu|moi ngay tu)\s*(\d{1,2})(?::(\d{2}))?\s*(?:gio)?\s*(?:den|toi|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:gio)',text)):
            fields['daily_window']={'start':f'{int(match[1]):02d}:{int(match[2] or 0):02d}', 'end':f'{int(match[3]):02d}:{int(match[4] or 0):02d}'}
        # Typed validation catches impossible day counts/party sizes from both parsers.
        fields=RequirementFields.model_validate(fields).model_dump(mode="json",exclude_none=True)
        allowed=set(TripRequest.model_fields)-{"user_id"}
        draft={k:v for k,v in (context or {}).items() if k in allowed}
        draft.update({k:v for k,v in fields.items() if k in allowed})
        unresolved=[]
        places=[json.loads(r['data']) for r in self.store.places()]
        if fields.get('city'):
            matches=sorted({p['city'] for p in places if folded(p['city'])==folded(fields['city'])})
            if len(matches)==1:fields['city']=draft['city']=matches[0]
        for key,target in [('required_place_names','required_place_ids'),('excluded_place_names','excluded_place_ids')]:
            if fields.get(key) is not None:
                ids=[]
                for name in fields[key]:
                    candidates=[p for p in places if p['active'] and (not draft.get('city') or folded(p['city'])==folded(draft['city']))
                                and folded(name)==folded(p['name'])]
                    if len(candidates)!=1:
                        candidates=[p for p in places if p['active'] and folded(name) in folded(p['name'])
                                    and (not draft.get('city') or folded(p['city'])==folded(draft['city']))]
                    if len(candidates)==1:ids.append(candidates[0]['place_id'])
                    else:unresolved.append(name)
                draft[target]=list(dict.fromkeys([*draft.get(target,[]),*ids]))
        # A date-only clarification must not replace the original semantic need,
        # even if the LLM echoes city/preferences from the supplied context.
        changed_preferences=fields.get('preferences') is not None and fields['preferences']!=(context or {}).get('preferences')
        if found or preferences or changed_preferences:
            draft["query"]=message[:2000]
        if any(re.search(r"\b"+term+r"\b",text) for term in ("khong muon","khong di","khong thich","khong can")):
            warnings.append("Phủ định trong yêu cầu chưa thành ràng buộc; backend cần gửi excluded_place_ids hoặc giới hạn cụ thể")
        if "khong muon di xa" in text or "khong di xa" in text:
            warnings.append("Muốn hạn chế đi xa: hãy gửi max_daily_distance_km/max_leg_minutes; không tự đặt ngưỡng")
        if any(word in text for word in ("ngan sach","trieu","gia re","chi phi")):
            warnings.append("Chưa tối ưu ngân sách vì dữ liệu giá chưa đầy đủ")
        missing=[key for key in ("city","start_date","days") if not draft.get(key)]
        return {"extractor":"gemini_structured" if use_llm else "vietnamese_rules_v1","draft":draft,
                "fields":fields,"missing_fields":missing,"needs_clarification":bool(missing or unresolved),
                'unresolved_place_names':unresolved,"warnings":warnings}
