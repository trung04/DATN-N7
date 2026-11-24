from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.tools.tool_registry import ToolRegistry

class TravelQAAgent:
    def __init__(self,rec):self.tools=ToolRegistry(rec)
    def run(self,message,place_id=None,requested_names=None):
        from app.modules.semantic_search.text_utils import folded
        import re
        if place_id:
            found={'warnings':[]}
            places=[self.tools.execute('place_details',{'place_id':place_id})]
        else:
            found=self.tools.execute("semantic_search",{"request":PlaceSearchRequest(query=message,limit=3,infer_filters=False).model_dump(mode="json")})
            places=[self.tools.execute("place_details",{"place_id":p["place_id"]}) for p in found["results"]]
        facts=[{k:p.get(k) for k in ("place_id","name","city","description","address","rating","opening_hours","weekly_opening_hours")} for p in places]
        if requested_names and not any(folded(p['name'])==folded(n) for p in facts for n in requested_names):
            return {'status':'not_found','facts':[],'answer':'Mình chưa tìm thấy địa điểm đúng tên này trong dữ liệu hiện có. Bạn kiểm tra lại tên hoặc cho mình thêm khu vực nhé?','warnings':found['warnings']}
        exact=[p for p in facts if folded(p['name']) in folded(message)]
        chosen=exact[0] if len(exact)==1 else facts[0] if len(facts)==1 else None
        answer='Mình chưa tìm thấy thông tin đủ chắc chắn về địa điểm này.'
        if chosen:
            name=chosen['name'];text=folded(message)
            if ('co gi' in text or 'thu vi' in text) and chosen.get('description'):
                answer=f"{name}: {chosen['description'][:250]}"
            elif 'mo cua' in text:
                hours=chosen.get('opening_hours') or ''
                answer=f"Theo thông tin hiện có, {name} mở cửa {hours[:100]}. Giờ thực tế có thể thay đổi." if re.fullmatch(r'\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}',hours.strip()) else f"Mình chưa có giờ mở cửa chắc chắn của {name}. Bạn nên kiểm tra trực tiếp với địa điểm nhé."
            elif 'danh gia' in text and chosen.get('rating') is not None:
                answer=f"{name} có điểm đánh giá {chosen['rating']}/5 trong dữ liệu hiện có."
            else:
                address=chosen.get('address')
                answer=f"{name}: {address}." if address else f"Mình chỉ có thông tin {name} ở {chosen['city']}, chưa có địa chỉ cụ thể."
        elif facts:answer='Bạn đang hỏi '+ ' hay '.join(p['name'] for p in facts[:3])+'?'
        return {"status":"grounded_candidates" if facts else "not_found","facts":facts,
                "answer":answer,
                "warnings":found["warnings"]+["Không xác minh giờ hoạt động thực tế hoặc suy thông tin còn thiếu"]}
