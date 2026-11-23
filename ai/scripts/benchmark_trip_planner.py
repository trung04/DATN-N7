"""Deterministic synthetic benchmark. No production data or external API calls.

Run from ai/: python -m scripts.benchmark_trip_planner
Every algorithm receives the same frozen candidates and directed matrix.
Distance/time reductions are reported only for identical scheduled place sets.
"""
import copy
import json
import random
import time
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
from app.modules.trip_planner.schemas import TripRequest


def run():
    output=[]
    for count in (5,10,20,30):
        rng=random.Random(2026+count)
        places=[{'place':{'place_id':str(i),'name':'Benchmark '+str(i),'city':'Benchmark',
                 'place_type':'Attraction','latitude':16.,'longitude':108.,'duration_minutes':20,
                 'opening_hours':'24/7'},'score':1-i/count,'required':True} for i in range(count)]
        minutes=[[0 if i==j else rng.randint(2,25) for j in range(count)] for i in range(count)]
        matrix={'source':'synthetic_benchmark','estimated':False,'warnings':[],
                'minutes':minutes,'kilometers':[[round(v*.4,3) for v in row] for row in minutes]}
        baseline=None
        for method in ('nearest_neighbor','greedy_insertion','greedy_2opt'):
            engine=PlanningEngine(None)
            engine.candidates=lambda *_:copy.deepcopy(places)
            engine.prepare=lambda *_:(copy.deepcopy(matrix),None)
            request=TripRequest(user_id='benchmark',city='Benchmark',start_date='2026-12-01',
                days=max(1,(count+9)//10),stops_per_day=10,breaks=[],daily_window={'start':'08:00','end':'18:00'},
                required_place_ids=[str(i) for i in range(count)],optimizer=method)
            start=time.perf_counter();plan=engine.build(request);elapsed=(time.perf_counter()-start)*1000
            ids={a['place_id'] for d in plan['days'] for a in d['activities']}
            distance=sum(d['total_distance_km'] for d in plan['days']);travel=sum(d['total_travel_seconds'] for d in plan['days'])/60
            violations=sum(d['total_activity_minutes']>480 for d in plan['days'])+len(plan['unscheduled_required_place_ids'])
            if baseline is None:baseline=(ids,distance,travel)
            comparable=ids==baseline[0]
            output.append({'candidates':count,'algorithm':method,'scheduled':len(ids),'distance_km':round(distance,3),
                'travel_minutes':round(travel,3),'runtime_ms':round(elapsed,3),'feasible':violations==0,'violations':violations,
                'same_selection_as_baseline':comparable,
                'distance_reduction_percent':round(100*(baseline[1]-distance)/baseline[1],2) if comparable and baseline[1] else None,
                'time_reduction_percent':round(100*(baseline[2]-travel)/baseline[2],2) if comparable and baseline[2] else None})
    return output


if __name__=='__main__':
    print(json.dumps({'dataset':'synthetic directed matrices; not real ORS performance','results':run()},indent=2))
