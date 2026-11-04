"""Binary relevance ranking metrics. No training or feedback writes."""
import math


def ranking_metrics(recommended, relevant, k=10):
    if k <= 0 or not relevant:
        raise ValueError("k must be positive and relevant items non-empty")
    relevant = set(relevant)
    recommended = list(dict.fromkeys(recommended))[:k]
    hits = [int(pid in relevant) for pid in recommended]
    dcg = sum(hit / math.log2(rank+2) for rank,hit in enumerate(hits))
    ideal = sum(1 / math.log2(rank+2) for rank in range(min(k, len(relevant))))
    return {"recall": sum(hits) / len(relevant), "ndcg": dcg / ideal,
            "precision": sum(hits) / k, "hit_rate": float(any(hits))}
