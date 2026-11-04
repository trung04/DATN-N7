import math
from collections import defaultdict

def item_cosine(left,right):
    common=left.keys() & right.keys()
    if len(common)<2:return 0.0
    norm=math.sqrt(sum(w*w for w in left.values())*sum(w*w for w in right.values()))
    if norm<=0:return 0.0
    return min(1.0,sum(left[u]*right[u] for u in common)/norm)*len(common)/(len(common)+10)

def collaborative_scores(aggregated, user_id, min_users=3):
    """Positive item-item cosine with at least two co-interacting users (online ItemKNN)."""
    users = {uid for uid, _ in aggregated}
    if len(users) < min_users:
        return {}
    item_users = defaultdict(dict)
    for (uid, pid), weight in aggregated.items():
        item_users[pid][uid] = weight
    seeds = {pid: w for (uid, pid), w in aggregated.items() if uid == user_id}
    if not seeds:
        return {}
    result = {}
    for pid, values in item_users.items():
        total = 0.0
        for seed, weight in seeds.items():
            if seed == pid:
                continue
            total += weight * item_cosine(values,item_users[seed])
        if total > 0:
            result[pid] = total / sum(seeds.values())
    return result
