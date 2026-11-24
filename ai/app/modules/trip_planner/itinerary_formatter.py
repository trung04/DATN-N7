from app.modules.semantic_search.text_utils import folded

def format_plan(req,days,matrix):
    from datetime import datetime
    from .schemas import minutes
    selected = {a["place_id"] for d in days for a in d["activities"]}
    unmet = sorted(set(req.required_place_ids)-selected)
    warnings = list(matrix["warnings"])
    if 'breaks' not in req.model_fields_set and req.breaks:
        warnings.append('Mặc định nghỉ 12:00–13:00; có thể đổi giờ nghỉ trong ràng buộc chuyến đi.')
    warnings.append('Giới hạn hoạt động tính tham quan, di chuyển và chờ; giờ nghỉ được tính riêng.' if req.fill_day else 'Giới hạn hoạt động mỗi ngày tính cả di chuyển, tham quan, nghỉ và thời gian chờ trong lịch.')
    if req.start_location is None and req.end_location is None:
        warnings.append('Lịch trình open route: không tự quay về địa điểm đầu tiên.')
    if req.start_location is None:
        warnings.append("Chưa có nơi xuất phát/lưu trú; mỗi ngày bắt đầu tại địa điểm đầu tiên, không tính chặng đến đó")
    if any(not d["validation"]["all_opening_hours_known"] for d in days):
        warnings.append("Một số địa điểm thiếu giờ mở cửa có cấu trúc; lịch trình cần được xác nhận")
    desired=0 if req.fill_day else sum(req.stop_limit(day+1) for day in range(req.days))
    for day in days:
        end=datetime.fromisoformat(day['end_time'])
        remaining=max(0,minutes(day['window']['end'])-(end.hour*60+end.minute))
        day['remaining_window_minutes']=remaining
        day['completion_reason']='stop_limit' if len(day['activities'])>=req.stop_limit(day['day']) else 'no_feasible_candidate'
        if req.fill_day and remaining>=60:
            warnings.append(f"Ngày {day['day']} còn {remaining} phút nhưng chưa thêm được điểm trong tập ứng viên hiện có mà vẫn giữ các ràng buộc.")
    empty_days=any(not day['activities'] for day in days)
    if len(selected) < desired or empty_days:
        warnings.append("Không đủ địa điểm phù hợp hoặc không xếp vừa ràng buộc; không tự nới yêu cầu")
    if unmet:
        warnings.append("Có địa điểm bắt buộc chưa xếp được; xem unscheduled_required_place_ids")
    preference_text=folded((req.query or "")+" "+" ".join(req.preferences or []))
    if any(term in preference_text for term in ("hoang hon","binh minh")):
        warnings.append("Chưa xác minh giờ/hướng ngắm hoàng hôn hoặc bình minh; gửi visit_windows cho địa điểm muốn đi vào khung giờ cụ thể")
    return {"city":req.city,"start_date":req.start_date.isoformat(),"timezone":"Asia/Ho_Chi_Minh",
        "party_size":req.party_size,"days":days,"routing":{"source":matrix["source"],"estimated":matrix["estimated"],
        "transport":req.transport},"optimizer":req.optimizer,
        "status":"partial" if unmet or len(selected)<desired or empty_days else "planned",
        "unscheduled_required_place_ids":unmet,"warnings":warnings,"budget_optimized":False,
        "summary":f"Lịch trình {req.days} ngày tại {req.city}, gồm {len(selected)} địa điểm. Tuyến được sắp xếp bằng heuristic, chưa bảo đảm tối ưu toàn cục."}
