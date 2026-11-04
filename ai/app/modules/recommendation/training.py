"""Offline item-KNN artifact training. Runtime remains online unless an artifact is configured."""
import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime,timezone
from itertools import combinations
from pathlib import Path
from .interaction_weights import aggregate_events


def fit_item_knn(events,cutoff,top_k=50,half_life_days=90):
    if cutoff.tzinfo is None or not 1<=top_k<=500 or half_life_days<=0:
        raise ValueError("Invalid cutoff/top_k/half_life_days")
    if cutoff>datetime.now(timezone.utc):raise ValueError("Cutoff không được ở tương lai")
    if any(datetime.fromisoformat(e["occurred_at"])>=cutoff for e in events):
        raise ValueError("Training snapshot có tương tác tại/sau cutoff")
    aggregated,_=aggregate_events(events,cutoff,half_life_days)
    items=defaultdict(dict)
    user_items=defaultdict(list)
    for (uid,pid),weight in aggregated.items():
        items[pid][uid]=weight
        user_items[uid].append(pid)
    pairs=set()
    for values in user_items.values():
        pairs.update(combinations(sorted(values),2))
    from .collaborative import item_cosine
    neighbors=defaultdict(list)
    for left,right in pairs:
        value=item_cosine(items[left],items[right])
        if value>0:
            neighbors[left].append({"place_id":right,"score":value})
            neighbors[right].append({"place_id":left,"score":value})
    return {"schema_version":1,"model_type":"item_knn_cosine","cutoff":cutoff.isoformat(),
        "half_life_days":half_life_days,"top_k":top_k,"users":len(user_items),"events":len(events),
        "neighbors":{pid:sorted(values,key=lambda x:(-x["score"],x["place_id"]))[:top_k] for pid,values in sorted(neighbors.items())}}


class TrainedItemKNN:
    def __init__(self,artifact):
        if artifact.get("schema_version")!=1 or artifact.get("model_type")!="item_knn_cosine":
            raise ValueError("Unsupported collaborative artifact")
        cutoff=datetime.fromisoformat(artifact["cutoff"])
        if cutoff.tzinfo is None or cutoff>datetime.now(timezone.utc):raise ValueError("Invalid artifact cutoff")
        neighbors=artifact.get("neighbors")
        if not isinstance(neighbors,dict):raise ValueError("Invalid neighbors")
        for pid,entries in neighbors.items():
            if not isinstance(pid,str) or not isinstance(entries,list):raise ValueError("Invalid item neighbors")
            for entry in entries:
                if not isinstance(entry.get("place_id"),str) or not math.isfinite(entry.get("score",float('nan'))) or not 0<=entry["score"]<=1:
                    raise ValueError("Invalid item score")
        self.artifact=artifact
        self.fingerprint=hashlib.sha256(json.dumps(artifact,sort_keys=True).encode()).hexdigest()[:12]

    @classmethod
    def load(cls,path):
        raw=Path(path).read_bytes()
        if len(raw)>50_000_000:raise ValueError("Artifact too large")
        return cls(json.loads(raw))

    def score(self,aggregated,user_id):
        seeds={pid:w for (uid,pid),w in aggregated.items() if uid==user_id}
        total=sum(seeds.values())
        if total<=0:return {}
        scores=defaultdict(float)
        for seed,weight in seeds.items():
            for entry in self.artifact["neighbors"].get(seed,[]):
                scores[entry["place_id"]]+=weight*entry["score"]/total
        return dict(scores)
