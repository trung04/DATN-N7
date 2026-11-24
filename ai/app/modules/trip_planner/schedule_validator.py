import re
from app.modules.semantic_search.text_utils import folded
from .schemas import minutes
from .meal_policy import meal_slots,visit_breaks,is_default_lunch_break
from .time_suitability import suitable_intervals,sunset_minute,night_market

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
    used_meals=set()
    distance,total_travel,total_seconds = 0.0,0,0.0
    last_visit_limit=end
    for index in route:
        candidate = candidates[index]
        place = candidate["place"]
        if previous is None:
            travel,km = 0,0.0
        else:
            travel,km = matrix["minutes"][previous][index],matrix["kilometers"][previous][index]
            if travel is None or km is None:
                return None
        seconds=travel*60
        travel=math.ceil(travel)
        if req.max_leg_minutes is not None and travel > req.max_leg_minutes:
            return None
        movement_breaks=visit_breaks(req,breaks,'lunch') if place['place_type']=='Restaurant' else breaks
        departure = advance(current,travel,movement_breaks) if travel else current
        arrival = departure+travel
        duration = req.duration_overrides.get(place["place_id"],candidate.get('visit_minutes',place["duration_minutes"] or (45 if place["place_type"]=="Restaurant" else 60)))
        intervals,source = opening_for(place,day,req)
        available = intervals if intervals is not None else [(begin,end)]
        available=suitable_intervals(place,available,day)
        sunset=sunset_minute(day,place['latitude'],place['longitude']) if candidate.get('sunset_visit') else None
        visit = None;selected_meal=None
        for left,right in sorted(available):
            visit_window=req.visit_windows.get(place["place_id"])
            if visit_window:
                left=max(left,minutes(visit_window.start))
                right=min(right,minutes(visit_window.end))
            for meal_left,meal_right,meal in meal_slots(req,place,duration,begin,end):
                if meal is not None and meal in used_meals:continue
                start=advance(max(arrival,left,begin,meal_left),duration,visit_breaks(req,breaks,meal))
                if sunset is not None:
                    start=advance(max(start,sunset-20),duration,visit_breaks(req,breaks,meal))
                    if start>sunset-10 or start+duration<sunset+10:continue
                if start+duration<=min(right,end,meal_right):
                    visit=start;selected_meal=meal;last_visit_limit=min(right,end,meal_right);break
            if visit is not None:break
        if visit is None:
            return None
        if selected_meal is not None:used_meals.add(selected_meal)
        notes = []
        if night_market(place):notes.append('Chợ đêm chỉ xếp từ 18:00; vẫn cần khớp giờ mở cửa trong dữ liệu')
        if sunset is not None:notes.append('Ngắm hoàng hôn theo giờ mặt trời lặn ước tính từ ngày/tọa độ; chưa xác minh hướng nhìn và thời tiết')
        if candidate.get('duration_source') in ('focus_estimate','similarity_estimate'):
            notes.append('Thời lượng là ước tính theo ưu tiên thời gian của bạn' if candidate['duration_source']=='focus_estimate' else 'Thời lượng là ước tính theo độ phù hợp nội dung với sở thích')
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
            'travel_from_previous_seconds':seconds,'distance_from_previous_meters':round(km*1000,3),'order':len(activities)+1,
            "opening_hours_checked":source!="unknown","opening_hours_source":source,"notes":notes,
            'duration_source':candidate.get('duration_source','explicit' if place['place_id'] in req.duration_overrides else 'catalog' if place['duration_minutes'] else 'type_estimate')})
        activities[-1]['meal_slot']=selected_meal
        activities[-1]['time_intent']='sunset' if sunset is not None else 'night_market' if night_market(place) else None
        activities[-1]['estimated_sunset_time']=f'{sunset//60:02d}:{sunset%60:02d}' if sunset is not None else None
        distance += km
        total_travel += travel
        total_seconds += seconds
        current,previous = visit+duration,index
    return_leg = None
    end_anchor=matrix.get('end_anchor')
    finish=end_anchor if end_anchor is not None else anchor if req.return_to_start else None
    if route and finish is not None:
        travel,km = matrix["minutes"][previous][finish],matrix["kilometers"][previous][finish]
        if travel is None or km is None:
            return None
        seconds=travel*60
        travel = math.ceil(travel)
        if req.max_leg_minutes is not None and travel > req.max_leg_minutes:
            return None
        departure = advance(current,travel,breaks) if travel else current
        current = departure+travel
        if current > end:
            return None
        distance += km
        total_travel += travel
        total_seconds += seconds
        return_leg = {"departure_time":stamp(day,departure),"arrival_time":stamp(day,current),
            "duration_minutes":travel,"distance_km":round(km,3)}
    if req.max_daily_distance_km is not None and distance > req.max_daily_distance_km+1e-8:
        return None
    total_visit=sum(a['duration_minutes'] for a in activities)
    total_break=sum(max(0,min(current,right)-max(begin,left)) for left,right in breaks)
    meal_pause=0
    for left,right in breaks:
        if is_default_lunch_break(req,(left,right)):
            overlap=sum(max(0,min(right,minutes(a['end_time'][11:16]))-max(left,minutes(a['start_time'][11:16]))) for a in activities if a.get('meal_slot')=='lunch')
            moving=sum(max(0,min(right,minutes(a['arrival_time'][11:16]))-max(left,minutes(a['departure_time'][11:16]))) for a in activities)
            total_break-=overlap+moving;meal_pause+=overlap
    active=current-begin-total_break-meal_pause if req.fill_day else current-begin
    if active>req.activity_limit(day_number):return None
    fillable_tail=0
    if route:
        cap=candidates[route[-1]].get('visit_cap',activities[-1]['duration_minutes'])
        last_end=minutes(activities[-1]['end_time'][11:16])
        fillable_tail=max(0,min(cap-activities[-1]['duration_minutes'],last_visit_limit-last_end,end-current))
    return {"day":day_number,"date":day.isoformat(),"window":window.model_dump(),"activities":activities,
        'fillable_tail_minutes':fillable_tail,
        "return_leg":return_leg,"total_distance_km":round(distance,3),"total_travel_minutes":total_travel,
        'total_visit_minutes':total_visit,'total_activity_minutes':active,'total_elapsed_minutes':current-begin,'total_break_minutes':total_break,'meal_pause_minutes':meal_pause,
        'total_distance_meters':round(distance*1000,3),'total_travel_seconds':total_seconds,
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
        used_meals=set()
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
            allowed_breaks=visit_breaks(req,[(minutes(b.start),minutes(b.end)) for b in req.breaks],activity.get('meal_slot'))
            if any(begin<right and end_min>left for left,right in allowed_breaks):
                errors.append(f"Trùng giờ nghỉ: {pid}")
            visit_window=req.visit_windows.get(pid)
            if visit_window and (begin<minutes(visit_window.start) or end_min>minutes(visit_window.end)):
                errors.append(f"Ngoài khung giờ tham quan yêu cầu: {pid}")
            if any("giả định" in note for note in activity["notes"]):
                assumptions.append(f"Thời lượng tham quan ước tính: {pid}")
            if pid in places:
                p=places[pid]
                if p['place_type']=='Restaurant':
                    slots=[name for left,right,name in meal_slots(req,p,activity['duration_minutes'],minutes(window.start),minutes(window.end)) if begin>=left and end_min<=right]
                    if not slots:errors.append(f'Nhà hàng ngoài giờ bữa ăn đã thống nhất: {pid}')
                    elif slots[0] in used_meals:errors.append(f'Trùng nhà hàng trong cùng một bữa: {pid}')
                    else:used_meals.add(slots[0])
                intervals,_=opening_for(p,start.date(),req)
                if intervals is None:
                    unknown.append(pid)
                elif not any(begin>=a and end_min<=b for a,b in intervals):
                    errors.append(f"Không còn khớp giờ mở cửa trong catalog: {pid}")
                if not any(begin>=a and end_min<=b for a,b in suitable_intervals(p,[(0,1440)],start.date())):
                    errors.append(f'Không phù hợp thời điểm tham quan: {pid}')
                if activity.get('time_intent')=='sunset':
                    setting=sunset_minute(start.date(),p['latitude'],p['longitude'])
                    if setting is None or begin>setting-10 or end_min<setting+10:errors.append(f'Không bao phủ thời điểm hoàng hôn ước tính: {pid}')
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
