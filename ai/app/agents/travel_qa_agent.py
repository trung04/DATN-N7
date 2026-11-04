from app.modules.semantic_search.schemas import PlaceSearchRequest
from app.tools.tool_registry import ToolRegistry

class TravelQAAgent:
    def __init__(self,rec):self.tools=ToolRegistry(rec)
    def run(self,message):
        found=self.tools.execute("semantic_search",{"request":PlaceSearchRequest(query=message,limit=3,infer_filters=False).model_dump(mode="json")})
        places=[self.tools.execute("place_details",{"place_id":p["place_id"]}) for p in found["results"]]
        facts=[{k:p.get(k) for k in ("place_id","name","city","address","rating","opening_hours","weekly_opening_hours")} for p in places]
        return {"status":"grounded_candidates" if facts else "not_found","facts":facts,
                "answer":"Các địa điểm dưới đây là ứng viên tìm trong catalog; hãy chọn đúng địa điểm trước khi xác nhận thông tin.",
                "warnings":found["warnings"]+["Không xác minh giờ hoạt động thực tế hoặc suy thông tin còn thiếu"]}
