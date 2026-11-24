from app.modules.semantic_search.text_utils import folded

def format_plan(req,days,matrix):
    from datetime import datetime
    from .schemas import minutes
    selected = {a["place_id"] for d in days for a in d["activities"]}
    unmet = sorted(set(req.required_place_ids)-selected)
    warnings = list(matrix["warnings"])
    warnings.append('Nhà hàng được xếp trong giờ bữa trưa/bữa tối; chỉ thay giờ theo yêu cầu rõ ràng của khách.')
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
        dinner=req.meal_start_times.get('dinner',req.meal_windows['dinner'].start)
        if minutes(day['window']['end'])<=minutes(dinner):
            warnings.append(f"Ngày {day['day']} kết thúc trước khi có đủ thời gian ăn tối; không tự chèn bữa tối vào cuối buổi chiều.")
        end=datetime.fromisoformat(day['end_time'])
        remaining=max(0,minutes(day['window']['end'])-(end.hour*60+end.minute))
        day['remaining_window_minutes']=remaining
        if day['activities']:
            first=datetime.fromisoformat(day['activities'][0]['start_time'])
            morning_gap=first.hour*60+first.minute-minutes(day['window']['start'])
            if morning_gap>=30:warnings.append(f"Ngày {day['day']} còn trống {morning_gap} phút đầu khung giờ do chưa ghép được điểm phù hợp; không coi thời gian chờ là tham quan.")
        day['completion_reason']='stop_limit' if len(day['activities'])>=req.stop_limit(day['day']) else 'no_feasible_candidate'
        if day.get('total_activity_minutes',0)>=req.activity_limit(day['day'])-5 and remaining>=60:
            day['completion_reason']='activity_budget'
            warnings.append(f"Ngày {day['day']} đã chạm giới hạn hoạt động {req.activity_limit(day['day'])} phút; cần thay giới hạn nếu muốn sử dụng thêm khung giờ.")
        if req.fill_day and remaining>=60:
            warnings.append(f"Ngày {day['day']} còn {remaining} phút nhưng chưa thêm được điểm trong tập ứng viên hiện có mà vẫn giữ các ràng buộc.")
    empty_days=any(not day['activities'] for day in days)
    if len(selected) < desired or empty_days:
        warnings.append("Không đủ địa điểm phù hợp hoặc không xếp vừa ràng buộc; không tự nới yêu cầu")
    if unmet:
        warnings.append("Có địa điểm bắt buộc chưa xếp được; xem unscheduled_required_place_ids")
    preference_text=folded((req.query or "")+" "+" ".join(req.preferences or []))
    if any(term in preference_text for term in ("hoang hon","binh minh")):
        warnings.append("Giờ hoàng hôn được ước tính theo ngày/tọa độ, không bảo đảm hướng nhìn hoặc thời tiết; bình minh chưa có tính giờ tự động.")
        if 'hoang hon' in preference_text or 'sunset' in preference_text:
            for day in days:
                if not any(a.get('time_intent')=='sunset' for a in day['activities']):
                    warnings.append(f"Ngày {day['day']} chưa xếp được điểm ngắm hoàng hôn khả thi trong dữ liệu và khung giờ đã chọn.")
    return {"city":req.city,"start_date":req.start_date.isoformat(),"timezone":"Asia/Ho_Chi_Minh",
        "party_size":req.party_size,"days":days,"routing":{"source":matrix["source"],"estimated":matrix["estimated"],
        "transport":req.transport},"optimizer":req.optimizer,
        "status":"partial" if unmet or len(selected)<desired or empty_days else "planned",
        "unscheduled_required_place_ids":unmet,"warnings":warnings,"budget_optimized":False,
        "summary":f"Lịch trình {req.days} ngày tại {req.city}, gồm {len(selected)} địa điểm. Tuyến được sắp xếp bằng heuristic, chưa bảo đảm tối ưu toàn cục."}
