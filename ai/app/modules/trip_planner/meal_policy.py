"""One restaurant per lunch/dinner slot, unless explicitly overridden."""
from .schemas import minutes


def meal_slots(req,place,duration,begin,end):
    pid=place['place_id']
    if place['place_type']!='Restaurant':return [(begin,end,None)]
    if pid in req.visit_windows:
        window=req.visit_windows[pid]
        return [(minutes(window.start),minutes(window.end),'explicit:'+pid)]
    slots=[]
    for name,window in req.meal_windows.items():
        if name in req.meal_start_times:
            start=minutes(req.meal_start_times[name]);slots.append((start,start+duration,name))
        else:slots.append((minutes(window.start),minutes(window.end),name))
    return sorted(slots)


def is_default_lunch_break(req,pair):
    return not req.meal_break_is_rest and pair==(720,780)


def visit_breaks(req,breaks,meal):
    return [b for b in breaks if not (meal=='lunch' and is_default_lunch_break(req,b))]
