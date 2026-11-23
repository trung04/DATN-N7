from .candidate_generator import CandidateGenerator
from .itinerary_formatter import format_plan
"""Greedy insertion + constrained 2-opt. Heuristic, not globally optimal or real-time traffic."""
import copy
import json

from app.core.exceptions import Conflict
from .schedule_validator import schedule_route
from .schemas import TripRequest
from .route_matrix import RouteMatrix
from .route_objective import travel_cost, improve_2opt
from .ors_matrix import OrsMatrix


class PlanningEngine:
    def __init__(self, recommendation, routing=None):
        self.rec = recommendation
        self.routing = routing or RouteMatrix()

    def candidates(self,req,required=None,excluded=None,query=None):
        return CandidateGenerator(self.rec).generate(req,required,excluded,query)

    def prepare(self, req, candidates):
        if not candidates:
            return {"source":"none","estimated":False,"warnings":[],"minutes":[],"kilometers":[]},None
        locations = [{"latitude":c["place"]["latitude"],"longitude":c["place"]["longitude"],"place_id":c["place"]["place_id"]} for c in candidates]
        anchor = None
        if req.start_location:
            anchor = len(locations)
            locations.append(req.start_location.model_dump())
        if not locations:
            return {"source":"none","estimated":False,"warnings":[],"minutes":[],"kilometers":[]},anchor
        end_anchor=None
        if req.end_location:
            end_anchor=len(locations)
            locations.append(req.end_location.model_dump())
        matrix=(OrsMatrix().build(locations,req.transport) if req.routing_provider=='ors'
                else self.routing.build(locations,req.transport,req.allow_estimated_routes))
        matrix['end_anchor']=end_anchor
        return matrix,anchor

    def schedule(self,route,day_number,req,candidates,matrix,anchor):
        return schedule_route(route,day_number,req,candidates,matrix,anchor)

    def plan_day(self, day_number, req, candidates, matrix, anchor, used, target=None):
        target=req.day_stop_limits.get(day_number,req.stops_per_day) if target is None else target
        route=[];current=self.schedule(route,day_number,req,candidates,matrix,anchor)
        ordered=sorted(range(len(candidates)),key=lambda i:(-int(candidates[i]['required']),-candidates[i]['score'],candidates[i]['place']['place_id']))
        for i in ordered:
            if i in used or len(route)>=target:continue
            options=[]
            for position in range(len(route)+1):
                trial=route[:position]+[i]+route[position:]
                schedule=self.schedule(trial,day_number,req,candidates,matrix,anchor)
                if schedule:options.append((travel_cost(schedule,req,matrix,len(candidates)),position,trial,schedule))
            if options:
                _,_,route,current=min(options,key=lambda o:(o[0],o[1]))
        if req.optimizer=='greedy_2opt':
            route,current,_,_=improve_2opt(route,current,lambda r:self.schedule(r,day_number,req,candidates,matrix,anchor),req,matrix,len(candidates))
        used.update(route)
        return current

    def build(self, req):
        candidates=self.candidates(req)
        matrix,anchor=self.prepare(req,candidates)
        routes=[[] for _ in range(req.days)]
        schedules=[self.schedule([],day+1,req,candidates,matrix,anchor) for day in range(req.days)]
        ordered=sorted(range(len(candidates)),key=lambda i:(-int(candidates[i]['required']),-candidates[i]['score'],candidates[i]['place']['place_id']))
        mixed={'Attraction','Restaurant'} <= {c['place']['place_type'] for c in candidates}
        def options(i,append_only=False,balance=True):
            values=[]
            for day,route in enumerate(routes):
                if len(route)>=req.day_stop_limits.get(day+1,req.stops_per_day):continue
                # Selection policy, not part of the distance/time objective:
                # leave room for sightseeing before adding a second optional meal.
                if balance and mixed and not candidates[i]['required'] and candidates[i]['place']['place_type']=='Restaurant' and any(candidates[j]['place']['place_type']=='Restaurant' for j in route):continue
                positions=[len(route)] if append_only else range(len(route)+1)
                for position in positions:
                    trial=route[:position]+[i]+route[position:]
                    schedule=self.schedule(trial,day+1,req,candidates,matrix,anchor)
                    if schedule:
                        delta=travel_cost(schedule,req,matrix,len(candidates))-travel_cost(schedules[day],req,matrix,len(candidates))
                        values.append((delta,len(route),day,position,trial,schedule))
            return values
        if req.optimizer=='nearest_neighbor':
            for required in (True,False):
                remaining=[i for i in ordered if candidates[i]['required']==required]
                while remaining:
                    choices=[(option,i) for i in remaining for option in options(i,True)]
                    if not choices:break
                    option,i=min(choices,key=lambda p:(p[0][0],p[0][1],-candidates[p[1]]['score'],p[1]))
                    _,_,day,_,routes[day],schedules[day]=option;remaining.remove(i)
        else:
            for i in ordered:
                values=options(i)
                if values:
                    _,_,day,_,route,schedule=min(values,key=lambda o:o[:4])
                    routes[day],schedules[day]=route,schedule
        # Soft preference only: if sightseeing cannot fill the remaining slots,
        # consider the other eligible places without silently relaxing time limits.
        used={i for route in routes for i in route}
        for i in ordered:
            if i in used:continue
            values=options(i,req.optimizer=='nearest_neighbor',False)
            if values:
                _,_,day,_,routes[day],schedules[day]=min(values,key=lambda o:o[:4]);used.add(i)
        if req.optimizer=='greedy_2opt':
            for day in range(req.days):
                routes[day],schedules[day],_,_=improve_2opt(routes[day],schedules[day],lambda r,d=day:self.schedule(r,d+1,req,candidates,matrix,anchor),req,matrix,len(candidates))
        return format_plan(req,schedules,matrix)

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
        limit=edit.target_stops or req.day_stop_limits.get(day_number,req.stops_per_day)
        if len(required)>limit:
            raise ValueError("Số địa điểm vượt stops_per_day")
        req = req.model_copy(deep=True)
        req.excluded_place_ids=sorted((set(req.excluded_place_ids)|set(edit.remove_place_ids))-set(edit.add_place_ids))
        if edit.target_stops is not None:req.day_stop_limits[day_number]=edit.target_stops
        if req.selected_place_ids:
            req.selected_place_ids = sorted((set(req.selected_place_ids)-set(edit.remove_place_ids))|set(edit.add_place_ids))
        req.required_place_ids = sorted((set(req.required_place_ids)-set(edit.remove_place_ids))|set(edit.add_place_ids))
        if edit.window:
            req.day_windows[day_number]=edit.window
        candidate_request=req.model_copy(deep=True)
        if candidate_request.selected_place_ids:
            candidate_request.selected_place_ids=[pid for pid in candidate_request.selected_place_ids if pid not in other_ids]
        candidates = self.candidates(candidate_request,required=required,excluded=other_ids|set(edit.remove_place_ids),query=edit.replacement_query)
        matrix,anchor=self.prepare(req,candidates)
        target=max(len(required),len(original_ids)) if edit.replacement_query else len(required)
        if edit.ordered_place_ids is not None:
            if len(edit.ordered_place_ids)!=len(set(edit.ordered_place_ids)) or set(edit.ordered_place_ids)!=original_ids:
                raise ValueError('Reordered IDs must contain each original place exactly once')
            lookup={c['place']['place_id']:i for i,c in enumerate(candidates)}
            changed=self.schedule([lookup[pid] for pid in edit.ordered_place_ids],day_number,req,candidates,matrix,anchor)
            if changed is None:raise Conflict('Requested order violates schedule constraints; original schedule retained')
        else:
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
        result["status"]="partial" if result["unscheduled_required_place_ids"] or any(len(d["activities"])<req.day_stop_limits.get(d['day'],req.stops_per_day) for d in result["days"]) else "planned"
        result["summary"]=f"Đã cập nhật riêng ngày {day_number}; các ngày khác giữ nguyên. Tổng {len(all_selected)} địa điểm."
        result["warnings"]=list(dict.fromkeys(result["warnings"]+matrix["warnings"]))
        result["last_edit"]={"day":day_number,"routing_source":matrix["source"],"estimated":matrix["estimated"]}
        return req,result
