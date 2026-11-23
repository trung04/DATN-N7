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


def build_personalized_profile(service, request, explicit, rows, now):
    events = sorted((e for e in service.store.interactions(request.user_id)
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


def rotate_recommendations(pool, baseline, vectors, request, recent):
    """Keep stable anchors, reserve up to 30% for relevant points absent from last list."""
    previous = {i['place_id'] for i in recent[0]['recommendations']} if recent else set()
    if not previous or not baseline:
        return baseline, {"rotation_applied": False, "fresh_count": 0, "rotation_target": 0}
    target = max(1, math.ceil(len(baseline) * .3))
    anchor_count = len(baseline) - target
    anchors = baseline[:anchor_count]
    threshold = max(i['score'] for i in pool) - .15
    fresh = [i for i in pool if i['place_id'] not in previous and i['score'] >= threshold
             and vectors.get(i['place_id']) is not None]
    recent_ids = {i['place_id'] for result in recent for i in result['recommendations']}
    unseen = [i for i in fresh if i['place_id'] not in recent_ids]
    # Prefer not shown in any of last three lists; relax to previous-list novelty if exhausted.
    chosen = rerank_mmr(unseen, vectors, anchor_count + min(target,len(unseen)), request.mmr_lambda, anchors)
    chosen = rerank_mmr(fresh, vectors, anchor_count + target, request.mmr_lambda, chosen)
    chosen = rerank_mmr(pool, vectors, len(baseline), request.mmr_lambda, chosen)
    for item in chosen:
        item['fresh_since_last'] = item['place_id'] not in previous
    count = sum(i['fresh_since_last'] for i in chosen)
    return chosen, {"rotation_applied": True, "rotation_target": target, "fresh_count": count,
                    "rotation_relevance_floor": threshold, "recent_lists_used": len(recent)}
