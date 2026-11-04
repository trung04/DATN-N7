import re
from app.modules.semantic_search.text_search import folded
from .schemas import minutes

WEEKDAYS = ("mon","tue","wed","thu","fri","sat","sun")
DAY_LABELS = (("thu 2","thu hai","monday"),("thu 3","thu ba","tuesday"),
              ("thu 4","thu tu","wednesday"),("thu 5","thu nam","thursday"),
              ("thu 6","thu sau","friday"),("thu 7","thu bay","saturday"),
              ("chu nhat","sunday"))


def opening_for(place, day, request):
    key = WEEKDAYS[day.weekday()]
    if place["place_id"] in request.opening_overrides:
        intervals = request.opening_overrides[place["place_id"]].get(key, [])
        return [(minutes(i.start),minutes(i.end)) for i in intervals], "request"
    closed = folded(place.get("closed_days") or "")
    if any(re.search(r"\b"+re.escape(label)+r"\b",closed) for label in DAY_LABELS[day.weekday()]):
        return [], "catalog_closed_day"
    weekly = place.get("weekly_opening_hours")
    if weekly is not None:
        return [(minutes(i["start"]),minutes(i["end"])) for i in weekly.get(key,[])], "catalog_weekly"
    raw = (place.get("opening_hours") or "").strip()
    if raw.casefold() in ("24/7","24h","open 24 hours","mở cửa cả ngày"):
        return [(0,1440)], "catalog_daily"
    match = re.fullmatch(r"([0-2]\d:[0-5]\d)\s*[-–]\s*([0-2]\d:[0-5]\d)",raw)
    if match:
        start,end = map(minutes,match.groups())
        if 0 <= start < end <= 1440:
            return [(start,end)], "catalog_daily"
    return None, "unknown"


def advance(start, duration, breaks):
    """Shift a whole movement/visit to avoid every blocked interval."""
    for left,right in sorted(breaks):
        if start < right and start+duration > left:
            start = right
    return start

import math
import json
from datetime import datetime, timedelta, timezone
from .schemas import TripRequest

def stamp(day, minute):
    return (datetime.combine(day,datetime.min.time(),tzinfo=timezone(timedelta(hours=7)))+timedelta(minutes=minute)).isoformat()

def schedule_route( route, day_number, req, candidates, matrix, anchor):
    day = req.start_date+timedelta(days=day_number-1)
    window = req.day_windows.get(day_number,req.daily_window)
    begin,end = minutes(window.start),minutes(window.end)
    breaks = [(minutes(b.start),minutes(b.end)) for b in req.breaks]
    current,previous = begin,anchor
    activities = []
    distance,total_travel = 0.0,0
    for index in route:
        candidate = candidates[index]
        place = candidate["place"]
        if previous is None:
            travel,km = 0,0.0
        else:
            travel,km = matrix["minutes"][previous][index],matrix["kilometers"][previous][index]
            if travel is None or km is None:
                return None
            travel = math.ceil(travel)
        if req.max_leg_minutes is not None and travel > req.max_leg_minutes:
            return None
        departure = advance(current,travel,breaks) if travel else current
        arrival = departure+travel
        duration = req.duration_overrides.get(place["place_id"],place["duration_minutes"] or (45 if place["place_type"]=="Restaurant" else 60))
        intervals,source = opening_for(place,day,req)
        available = intervals if intervals is not None else [(begin,end)]
        visit = None
        for left,right in sorted(available):
            visit_window=req.visit_windows.get(place["place_id"])
            if visit_window:
                left=max(left,minutes(visit_window.start))
                right=min(right,minutes(visit_window.end))
            start = advance(max(arrival,left,begin),duration,breaks)
            if start+duration <= min(right,end):
                visit = start
                break
        if visit is None:
            return None
        notes = []
        if source == "unknown":
            notes.append("Chưa kiểm tra được giờ mở cửa; cần xác nhận trước khi đi")
        if not place["duration_minutes"] and place["place_id"] not in req.duration_overrides:
            notes.append("Thời lượng tham quan là giả định theo loại địa điểm")
        if previous is None:
            notes.append("Chưa có điểm xuất phát; không tính chặng đến địa điểm đầu tiên")
        if matrix["estimated"]:
            notes.append("Thời gian di chuyển là ước tính, không phải tuyến đường được xác minh")
        activities.append({"place_id":place["place_id"],"name":place["name"],"place_type":place["place_type"],
            "latitude":place["latitude"],"longitude":place["longitude"],"start_time":stamp(day,visit),
            "end_time":stamp(day,visit+duration),"duration_minutes":duration,"departure_time":stamp(day,departure),
            "arrival_time":stamp(day,arrival),"travel_time_from_previous":travel,"distance_from_previous_km":round(km,3),
            "waiting_minutes":visit-arrival+departure-current,"recommendation_score":candidate["score"],
            "opening_hours_checked":source!="unknown","opening_hours_source":source,"notes":notes})
        distance += km
        total_travel += travel
        current,previous = visit+duration,index
    return_leg = None
    if route and req.return_to_start:
        travel,km = matrix["minutes"][previous][anchor],matrix["kilometers"][previous][anchor]
        if travel is None or km is None:
            return None
        travel = math.ceil(travel)
        if req.max_leg_minutes is not None and travel > req.max_leg_minutes:
            return None
        departure = advance(current,travel,breaks) if travel else current
        current = departure+travel
        if current > end:
            return None
        distance += km
        total_travel += travel
        return_leg = {"departure_time":stamp(day,departure),"arrival_time":stamp(day,current),
            "duration_minutes":travel,"distance_km":round(km,3)}
    if req.max_daily_distance_km is not None and distance > req.max_daily_distance_km+1e-8:
        return None
    return {"day":day_number,"date":day.isoformat(),"window":window.model_dump(),"activities":activities,
        "return_leg":return_leg,"total_distance_km":round(distance,3),"total_travel_minutes":total_travel,
        "routing":{"source":matrix["source"],"estimated":matrix["estimated"],"transport":req.transport},
        "end_time":stamp(day,current),"validation":{"no_overlaps":True,"within_day_window":True,
        "known_opening_hours_respected":True,"all_opening_hours_known":all(a["opening_hours_checked"] for a in activities)}}

def validate_stored_trip(rec,stored,trip_id):
    from .schemas import minutes
    req=TripRequest.model_validate_json(stored["request"])
    result=json.loads(stored["result"])
    errors,unknown,seen=[],[],set()
    assumptions=[]
    places={r["id"]:json.loads(r["data"]) for r in rec.store.places()}
    for day in result["days"]:
        window=req.day_windows.get(day["day"],req.daily_window)
        previous=None
        for activity in day["activities"]:
            pid=activity["place_id"]
            start,end=map(datetime.fromisoformat,(activity["start_time"],activity["end_time"]))
            departure,arrival=map(datetime.fromisoformat,(activity["departure_time"],activity["arrival_time"]))
            if pid in seen or pid not in places or not places[pid]["active"]:
                errors.append(f"Địa điểm trùng, không còn tồn tại hoặc ngừng hoạt động: {pid}")
            seen.add(pid)
            if (previous and departure<previous) or arrival>start or end<=start:
                errors.append(f"Thứ tự thời gian không hợp lệ: {pid}")
            begin,end_min=start.hour*60+start.minute,end.hour*60+end.minute
            if begin<minutes(window.start) or end_min>minutes(window.end):
                errors.append(f"Ngoài khung ngày: {pid}")
            if any(begin<minutes(b.end) and end_min>minutes(b.start) for b in req.breaks):
                errors.append(f"Trùng giờ nghỉ: {pid}")
            visit_window=req.visit_windows.get(pid)
            if visit_window and (begin<minutes(visit_window.start) or end_min>minutes(visit_window.end)):
                errors.append(f"Ngoài khung giờ tham quan yêu cầu: {pid}")
            if any("giả định" in note for note in activity["notes"]):
                assumptions.append(f"Thời lượng tham quan ước tính: {pid}")
            if pid in places:
                p=places[pid]
                intervals,_=opening_for(p,start.date(),req)
                if intervals is None:
                    unknown.append(pid)
                elif not any(begin>=a and end_min<=b for a,b in intervals):
                    errors.append(f"Không còn khớp giờ mở cửa trong catalog: {pid}")
                if p["latitude"]!=activity["latitude"] or p["longitude"]!=activity["longitude"]:
                    errors.append(f"Tọa độ đã thay đổi, cần tính lại tuyến: {pid}")
            previous=end
    unmet=sorted(set(req.required_place_ids)-seen)
    if unmet:
        errors.append("Thiếu địa điểm bắt buộc: "+", ".join(unmet))
    complete=result["status"]=="planned" and not unmet
    return {"trip_id":trip_id,"version":stored["version"],"valid":not errors,"complete":complete,
        "status":"invalid" if errors else "incomplete" if not complete else "valid_with_assumptions" if unknown or assumptions or result["routing"]["estimated"] else "valid_against_catalog",
        "errors":errors,"unknown_opening_place_ids":unknown,"routing":result["routing"],
        "assumptions":assumptions,
        "note":"Kiểm tra với catalog hiện tại và tuyến đã lưu; không kiểm tra giao thông/lịch hoạt động thời gian thực"}
