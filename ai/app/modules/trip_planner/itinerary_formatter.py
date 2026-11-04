from app.modules.semantic_search.text_utils import folded

def format_plan(req,days,matrix):
    selected = {a["place_id"] for d in days for a in d["activities"]}
    unmet = sorted(set(req.required_place_ids)-selected)
    warnings = list(matrix["warnings"])
    if req.start_location is None:
        warnings.append("Chưa có nơi xuất phát/lưu trú; mỗi ngày bắt đầu tại địa điểm đầu tiên, không tính chặng đến đó")
    if any(not d["validation"]["all_opening_hours_known"] for d in days):
        warnings.append("Một số địa điểm thiếu giờ mở cửa có cấu trúc; lịch trình cần được xác nhận")
    if len(selected) < req.days*req.stops_per_day:
        warnings.append("Không đủ địa điểm phù hợp hoặc không xếp vừa ràng buộc; không tự nới yêu cầu")
    if unmet:
        warnings.append("Có địa điểm bắt buộc chưa xếp được; xem unscheduled_required_place_ids")
    preference_text=folded((req.query or "")+" "+" ".join(req.preferences or []))
    if any(term in preference_text for term in ("hoang hon","binh minh")):
        warnings.append("Chưa xác minh giờ/hướng ngắm hoàng hôn hoặc bình minh; gửi visit_windows cho địa điểm muốn đi vào khung giờ cụ thể")
    return {"city":req.city,"start_date":req.start_date.isoformat(),"timezone":"Asia/Ho_Chi_Minh",
        "party_size":req.party_size,"days":days,"routing":{"source":matrix["source"],"estimated":matrix["estimated"],
        "transport":req.transport},"optimizer":"greedy_insertion_constrained_2opt_v1",
        "status":"partial" if unmet or len(selected)<req.days*req.stops_per_day else "planned",
        "unscheduled_required_place_ids":unmet,"warnings":warnings,"budget_optimized":False,
        "summary":f"Lịch trình {req.days} ngày tại {req.city}, gồm {len(selected)} địa điểm. Tuyến được sắp xếp bằng heuristic, chưa bảo đảm tối ưu toàn cục."}
