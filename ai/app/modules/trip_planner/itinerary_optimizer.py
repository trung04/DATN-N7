from .candidate_generator import CandidateGenerator
from .itinerary_formatter import format_plan
"""Greedy insertion + constrained 2-opt. Heuristic, not globally optimal or real-time traffic."""
import copy
import json
import math
from datetime import datetime, timedelta, timezone

from app.modules.semantic_search.text_search import PlaceSearchService, PlaceSearchRequest, SearchFilters, folded
from app.modules.recommendation.schemas import RecommendationRequest
from app.database.sqlite import Conflict
from .schedule_validator import schedule_route
from .schemas import minutes, TripRequest
from .route_matrix import RouteMatrix


class PlanningEngine:
    def __init__(self, recommendation, routing=None):
        self.rec = recommendation
        self.routing = routing or RouteMatrix()

    def candidates(self,req,required=None,excluded=None,query=None):
        return CandidateGenerator(self.rec).generate(req,required,excluded,query)

    def prepare(self, req, candidates):
        if not candidates:
            return {"source":"none","estimated":False,"warnings":[],"minutes":[],"kilometers":[]},None
        locations = [{"latitude":c["place"]["latitude"],"longitude":c["place"]["longitude"]} for c in candidates]
        anchor = None
        if req.start_location:
            anchor = len(locations)
            locations.append(req.start_location.model_dump())
        if not locations:
            return {"source":"none","estimated":False,"warnings":[],"minutes":[],"kilometers":[]},anchor
        return self.routing.build(locations,req.transport,req.allow_estimated_routes),anchor

    def schedule(self,route,day_number,req,candidates,matrix,anchor):
        return schedule_route(route,day_number,req,candidates,matrix,anchor)

    def plan_day(self, day_number, req, candidates, matrix, anchor, used, target=None):
        route = []
        target = req.stops_per_day if target is None else target
        current = self.schedule(route,day_number,req,candidates,matrix,anchor)
        while len(route) < target:
            options = []
            for i,c in enumerate(candidates):
                if i in used or i in route:
                    continue
                # Keep some variety; at most two restaurants per day.
                if c["place"]["place_type"]=="Restaurant" and sum(candidates[j]["place"]["place_type"]=="Restaurant" for j in route)>=2:
                    continue
                for position in range(len(route)+1):
                    trial = route[:position]+[i]+route[position:]
                    schedule = self.schedule(trial,day_number,req,candidates,matrix,anchor)
                    if schedule is None:
                        continue
                    penalty = 0.008*(schedule["total_travel_minutes"]-current["total_travel_minutes"])
                    options.append(((int(c["required"]),c["score"]-penalty),trial,schedule))
            if not options:
                break
            _,route,current = max(options,key=lambda o:o[0])
        # Reversal is accepted only if the entire time-window/break/return schedule still fits.
        for _ in range(3):
            improved = False
            for left in range(len(route)):
                for right in range(left+2,len(route)+1):
                    trial = route[:left]+list(reversed(route[left:right]))+route[right:]
                    schedule = self.schedule(trial,day_number,req,candidates,matrix,anchor)
                    if schedule and schedule["total_travel_minutes"] < current["total_travel_minutes"]:
                        route,current,improved = trial,schedule,True
            if not improved:
                break
        used.update(route)
        return current

    def build(self, req):
        candidates = self.candidates(req)
        matrix,anchor = self.prepare(req,candidates)
        days,used = [],set()
        for day_number in range(1,req.days+1):
            days.append(self.plan_day(day_number,req,candidates,matrix,anchor,used))
        return format_plan(req,days,matrix)

    def edit(self, stored, day_number, edit):
        req = TripRequest.model_validate_json(stored["request"])
        result = json.loads(stored["result"])
        if stored["version"] != edit.expected_version:
            raise Conflict("Lịch trình đã đổi; tải lại trước khi sửa")
        if day_number < 1 or day_number > req.days:
            raise ValueError("Ngày chỉnh sửa ngoài chuyến đi")
        original = result["days"][day_number-1]
        original_ids = {a["place_id"] for a in original["activities"]}
        if not set(edit.remove_place_ids)<=original_ids:
            raise ValueError("Địa điểm cần bỏ không nằm trong ngày này")
        other_ids = {a["place_id"] for d in result["days"] if d["day"]!=day_number for a in d["activities"]}
        if set(edit.add_place_ids)&other_ids:
            raise ValueError("Địa điểm mới đã có trong ngày khác")
        required = (original_ids-set(edit.remove_place_ids))|set(edit.add_place_ids)
        if len(required)>req.stops_per_day:
            raise ValueError("Số địa điểm vượt stops_per_day")
        req = req.model_copy(deep=True)
        if edit.window:
            req.day_windows[day_number]=edit.window
        candidates = self.candidates(req,required=required,excluded=other_ids|set(edit.remove_place_ids),query=edit.replacement_query)
        matrix,anchor=self.prepare(req,candidates)
        target=req.stops_per_day if edit.replacement_query else len(required)
        changed=self.plan_day(day_number,req,candidates,matrix,anchor,set(),target=target)
        selected={a["place_id"] for a in changed["activities"]}
        if not required<=selected:
            raise Conflict("Không xếp vừa các địa điểm giữ lại/thêm mới trong ràng buộc ngày; lịch cũ được giữ nguyên")
        result["days"][day_number-1]=changed
        for day in result["days"]:
            day.setdefault("routing",copy.deepcopy(result["routing"]))
        sources={day["routing"]["source"] for day in result["days"]}
        result["routing"]={"source":next(iter(sources)) if len(sources)==1 else "mixed",
            "estimated":any(day["routing"]["estimated"] for day in result["days"]),"transport":req.transport}
        req.required_place_ids=sorted((set(req.required_place_ids)-set(edit.remove_place_ids))|set(edit.add_place_ids))
        all_selected={a["place_id"] for d in result["days"] for a in d["activities"]}
        result["unscheduled_required_place_ids"]=sorted(set(req.required_place_ids)-all_selected)
        result["status"]="partial" if result["unscheduled_required_place_ids"] or any(len(d["activities"])<req.stops_per_day for d in result["days"]) else "planned"
        result["summary"]=f"Đã cập nhật riêng ngày {day_number}; các ngày khác giữ nguyên. Tổng {len(all_selected)} địa điểm."
        result["warnings"]=list(dict.fromkeys(result["warnings"]+matrix["warnings"]))
        result["last_edit"]={"day":day_number,"routing_source":matrix["source"],"estimated":matrix["estimated"]}
        return req,result
