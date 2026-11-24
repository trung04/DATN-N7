"""Online user-vector aggregation and deterministic MMR, no model training."""
from collections import defaultdict
from datetime import datetime
import json
import math
import numpy as np
from app.core.vectors import normalize
from .profiles import InterestProfile

BEHAVIOR_WEIGHTS = {"view": 1.0, "repeat_view_cap": 2.0, "favorite": 3.0,
                    "save": 4.0, "positive_rating": 5.0}
PROFILE_VERSION = "behavior-profile-mmr-v1"


def aggregate_signals(events):
    states = defaultdict(lambda: {"views": 0, "favorite": False, "save": False, "rating": None})
    for event in events:
        state = states[event["place_id"]]
        if event["action"] == "view":
            state["views"] = min(2, state["views"] + 1)
        elif event["action"] == "rating":
            state["rating"] = event["rating"]
        else:
            state[event["action"]] = event["active"]
    positive, negative = {}, set()
    for pid, state in states.items():
        rating = state["rating"]
        # A low latest rating overrides earlier positive actions; 3 stars is neutral.
        if rating is not None and rating < 3:
            negative.add(pid)
            continue
        weight = (BEHAVIOR_WEIGHTS["view"] * state["views"]
                  + BEHAVIOR_WEIGHTS["favorite"] * state["favorite"]
                  + BEHAVIOR_WEIGHTS["save"] * state["save"])
        if rating is not None:
            weight += BEHAVIOR_WEIGHTS["positive_rating"] * max(0, (rating - 3) / 2)
        if weight > 0:
            positive[pid] = weight
    return positive, negative


def build_personalized_profile(service, request, explicit, rows, now, events=None):
    events = sorted((e for e in (events if events is not None else service.store.interactions(request.user_id))
              if datetime.fromisoformat(e["occurred_at"]) <= now),
              key=lambda e: (datetime.fromisoformat(e["occurred_at"]), e["event_id"]))
    positive, negative = aggregate_signals(events)
    weighted = []
    for row in rows:
        if row["id"] not in positive:
            continue
        if not json.loads(row["data"])["active"]:
            continue
        vector = service._vector(row)
        if vector is not None:
            weighted.append((vector, positive[row["id"]]))
    hist = normalize(sum((v * w for v, w in weighted))) if weighted else None
    pref = normalize(sum((v * w for v, w in zip(explicit.groups, explicit.weights)))) if explicit.groups else None
    alpha = request.preference_alpha
    if pref is not None and hist is not None:
        merged = normalize(alpha * pref + (1 - alpha) * hist)
        if merged is None:
            merged = pref if alpha >= .5 else hist
    else:
        merged = pref if pref is not None else hist
    profile = InterestProfile([merged] if merged is not None else [], [1.] if merged is not None else [], explicit.query)
    return profile, negative, {"history_event_count": len(events), "history_places_used": len(weighted),
        "history_places_without_vector": len(positive) - len(weighted), "negative_places_excluded": len(negative),
        "preference_alpha": alpha, "profile_version": PROFILE_VERSION,
        "behavior_weights": BEHAVIOR_WEIGHTS, "history_available": hist is not None}


def rerank_mmr(items, vectors, limit, diversity_lambda, initial=None):
    """Input already relevance-sorted. All similarities scaled from cosine to [0,1]."""
    selected = list(initial or [])
    remaining = [i for i in items if i['place_id'] not in {s['place_id'] for s in selected}]
    while remaining and len(selected) < limit:
        ranked = []
        for item in remaining:
            vector = vectors.get(item["place_id"])
            redundancy = 0.0
            if selected:
                # Unknown vector cannot be evidence of novelty: use conservative penalty.
                redundancy = max((float(np.clip((np.dot(vector, vectors[s["place_id"]]) + 1) / 2, 0, 1))
                    if vector is not None and vectors.get(s["place_id"]) is not None else 1.0) for s in selected)
            score = diversity_lambda * item["score"] - (1 - diversity_lambda) * redundancy
            ranked.append((score, item["score"], item["place_id"], item, redundancy))
        score, _, _, chosen, redundancy = min(ranked, key=lambda x: (-x[0], -x[1], x[2]))
        selected.append({**chosen, "mmr_score": score, "redundancy_score": redundancy})
        remaining = [i for i in remaining if i["place_id"] != chosen["place_id"]]
    return selected


def relevance_value(item):
    value=item.get('intent_score')
    if value is None:value=item.get('content_score')
    return (value+1)/2 if value is not None else item['score']


def guarded_mmr(items,vectors,limit,diversity_lambda,tolerance,initial=None,floor=None):
    """Diversify only near the best remaining intent; never cross the Top-K relevance floor."""
    if not items:return list(initial or [])[:limit]
    ordered=sorted((relevance_value(item) for item in items),reverse=True)
    if floor is None:floor=ordered[min(limit,len(ordered))-1]-tolerance
    selected=list(initial or [])[:limit]
    known={item['place_id'] for item in selected}
    remaining=[item for item in items if item['place_id'] not in known and relevance_value(item)>=floor-1e-12]
    all_items=selected+remaining
    # Precompute shared similarities once, avoiding repeated O(K^2*N) cosine work.
    positions={item['place_id']:i for i,item in enumerate(all_items)}
    similarity=np.ones((len(all_items),len(all_items)),dtype=np.float32)
    valid=[(i,vectors.get(item['place_id'])) for i,item in enumerate(all_items) if vectors.get(item['place_id']) is not None]
    if valid:
        matrix=np.stack([v for _,v in valid]);values=np.clip((matrix @ matrix.T+1)/2,0,1)
        indices=[i for i,_ in valid];similarity[np.ix_(indices,indices)]=values
    while remaining and len(selected)<limit:
        best=max(relevance_value(item) for item in remaining)
        eligible=[item for item in remaining if relevance_value(item)>=best-tolerance-1e-12]
        ranked=[]
        selected_indices=[positions[s['place_id']] for s in selected]
        for item in eligible:
            redundancy=float(np.max(similarity[positions[item['place_id']],selected_indices])) if selected_indices else 0.
            score=diversity_lambda*item['score']-(1-diversity_lambda)*redundancy
            ranked.append((score,item,redundancy))
        score,chosen,redundancy=min(ranked,key=lambda r:(-r[0],-relevance_value(r[1]),-r[1]['score'],r[1]['place_id']))
        selected.append({**chosen,'mmr_score':score,'redundancy_score':redundancy})
        remaining=[item for item in remaining if item['place_id']!=chosen['place_id']]
    return selected


def rerank_with_policy(items,vectors,limit,request,initial=None,floor=None):
    if request.diversity_policy=='legacy':return rerank_mmr(items,vectors,limit,request.mmr_lambda,initial)
    return guarded_mmr(items,vectors,limit,request.mmr_lambda,request.mmr_relevance_tolerance,initial,floor)


def relevance_safe(pool,ranking,tolerance):
    """Validate rotation against the full pool, not only the fresh-item subset."""
    remaining={item['place_id']:item for item in pool}
    for item in ranking:
        if item['place_id'] not in remaining:return False
        best=max(relevance_value(candidate) for candidate in remaining.values())
        if relevance_value(item)<best-tolerance-1e-12:return False
        remaining.pop(item['place_id'])
    return True


def rotate_recommendations(pool, baseline, vectors, request, recent):
    """Keep stable anchors, reserve up to 30% for relevant points absent from last list."""
    previous = {i['place_id'] for i in recent[0]['recommendations']} if recent else set()
    if not previous or not baseline:
        return baseline, {"rotation_applied": False, "fresh_count": 0, "rotation_target": 0}
    target = max(1, math.ceil(len(baseline) * .3))
    floor=None
    if request.diversity_policy=='guarded':
        values=sorted((relevance_value(item) for item in pool),reverse=True)
        floor=values[min(request.limit,len(values))-1]-request.mmr_relevance_tolerance
    anchor_count = len(baseline) - target
    anchors = baseline[:anchor_count]
    threshold = max(i['score'] for i in pool) - .15
    fresh = [i for i in pool if i['place_id'] not in previous and i['score'] >= threshold
             and vectors.get(i['place_id']) is not None and (floor is None or relevance_value(i)>=floor)]
    recent_ids = {i['place_id'] for result in recent for i in result['recommendations']}
    unseen = [i for i in fresh if i['place_id'] not in recent_ids]
    # Prefer not shown in any of last three lists; relax to previous-list novelty if exhausted.
    chosen = rerank_with_policy(unseen, vectors, anchor_count + min(target,len(unseen)), request, anchors, floor)
    chosen = rerank_with_policy(fresh, vectors, anchor_count + target, request, chosen, floor)
    chosen = rerank_with_policy(pool, vectors, len(baseline), request, chosen, floor)
    if request.diversity_policy=='guarded' and not relevance_safe(pool,chosen,request.mmr_relevance_tolerance):
        unchanged=[{**item,'fresh_since_last':item['place_id'] not in previous} for item in baseline]
        return unchanged, {'rotation_applied':False,'rotation_relevance_guard_blocked':True,
            'rotation_target':target,'fresh_count':sum(i['fresh_since_last'] for i in unchanged),'recent_lists_used':len(recent)}
    for item in chosen:
        item['fresh_since_last'] = item['place_id'] not in previous
    count = sum(i['fresh_since_last'] for i in chosen)
    return chosen, {"rotation_applied": True, "rotation_target": target, "fresh_count": count,
                    "rotation_relevance_floor": threshold, "recent_lists_used": len(recent)}
