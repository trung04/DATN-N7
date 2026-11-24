"""Estimated dwell times, separate from factual catalog duration and rating.

No LLM computes minutes. Extra dwell is added only if re-scheduling remains valid.
"""
import math
from app.core.vectors import normalize


def prepare_durations(req,candidates,rec=None):
    if req.visit_duration_mode!='adaptive' or not candidates:return candidates
    raw=[float(c.get('semantic_score',c['score'])) for c in candidates]
    if req.duration_focus and rec is not None:
        query=normalize(rec.content.embedding.embed_text('. '.join(req.duration_focus)))
        if query is not None:
            vectors={r['id']:r.get('vector') for r in rec.store.places()}
            import json
            raw=[]
            for c in candidates:
                vector=vectors.get(c['place']['place_id'])
                value=normalize(json.loads(vector)) if isinstance(vector,str) and vector else None
                if value is None or value.shape!=query.shape:
                    value=normalize(rec.content.embedding.embed_text(rec._text(c['place'])))
                raw.append(float(query@value) if value is not None else 0.)
    low,high=min(raw),max(raw)
    for c,score in zip(candidates,raw):
        weight=(score-low)/(high-low) if high-low>1e-8 else .5
        place=c['place'];pid=place['place_id']
        reference=place.get('duration_minutes')
        # Generic one-hour catalog entries are a reference, not a hard booking.
        base=reference if reference and reference!=60 else int(5*round((45+45*weight)/5))
        cap=max(base,120 if place['place_type']=='Restaurant' else 180)
        if reference and reference>180:cap=reference
        c['visit_minutes']=req.duration_overrides.get(pid,base)
        c['visit_cap']=req.duration_overrides.get(pid,cap)
        c['duration_weight']=.1+weight*weight
        c['duration_source']='explicit' if pid in req.duration_overrides else 'focus_estimate' if req.duration_focus else 'similarity_estimate'
    return candidates


def distribute_spare_time(route,day,req,candidates,matrix,anchor,schedule):
    """Weighted fair allocation in 5-minute units; check EVERY changed schedule."""
    current=schedule(route,day,req,candidates,matrix,anchor)
    if not current or req.visit_duration_mode!='adaptive':return current
    from copy import deepcopy
    local=deepcopy(candidates)
    for i,activity in zip(route,current['activities']):local[i]['visit_minutes']=activity['duration_minutes']
    added={i:0 for i in route};blocked=set()
    while True:
        choices=[i for i in route if i not in blocked and local[i].get('visit_minutes',0)+5<=local[i].get('visit_cap',0)]
        if not choices:break
        i=min(choices,key=lambda j:((added[j]+5)/local[j].get('duration_weight',1),j))
        local[i]['visit_minutes']+=5
        trial=schedule(route,day,req,local,matrix,anchor)
        if trial:
            current=trial;added[i]+=5
        else:
            local[i]['visit_minutes']-=5;blocked.add(i)
    return current
