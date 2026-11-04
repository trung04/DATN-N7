import math
from collections import Counter, defaultdict
from datetime import datetime

def aggregate_events(events, now, half_life_days):
    """Cap repeated implicit events daily. Last explicit state wins; dismiss blocks."""
    buckets = Counter()
    latest = {}
    weights = {"view": 0.15, "click": 0.4, "booking": 3.0}
    for event in sorted(events, key=lambda e: (e["occurred_at"], e["event_id"])):
        dt = datetime.fromisoformat(event["occurred_at"])
        if dt > now:
            continue
        uid, pid, kind = event["user_id"], event["place_id"], event["interaction_type"]
        if kind == "view" and (event.get("dwell_seconds") or 0) < 10:
            continue
        if kind in weights:
            buckets[(uid, pid, kind, dt.date())] += 1
        else:
            group = "favorite" if kind in ("favorite", "unfavorite") else kind
            latest[(uid, pid, group)] = event
    scores = defaultdict(float)
    for (uid, pid, kind, day), count in buckets.items():
        age = max(0, (now.date() - day).days)
        scores[(uid, pid)] += weights[kind] * math.log1p(min(count, 3)) * 2 ** (-age / half_life_days)
    blocked = set()
    for (uid, pid, group), event in latest.items():
        age = max(0, (now - datetime.fromisoformat(event["occurred_at"])).total_seconds() / 86400)
        decay = 2 ** (-age / half_life_days)
        if group == "dismiss" or (group == "rating" and event["rating"] <= 2):
            blocked.add((uid, pid))
        elif group == "favorite" and event["interaction_type"] == "favorite":
            scores[(uid, pid)] += 2 * decay
        elif group == "rating" and event["rating"] >= 4:
            scores[(uid, pid)] += (event["rating"] - 3) * decay
    return {key: min(value, 10.0) for key, value in scores.items() if key not in blocked and value > 1e-8}, blocked
