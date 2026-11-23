"""Graded retrieval metrics. Grade >=2 is binary relevance; gain=2**grade-1."""
import math


def ranking_metrics(ids, judgments, k, relevant_grade=2):
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate place IDs in ranked results')
    relevant = {pid for pid, grade in judgments.items() if grade >= relevant_grade}
    top = ids[:k]
    recall = len(set(top) & relevant) / len(relevant) if relevant else None
    rr = next((1 / rank for rank, pid in enumerate(top, 1) if pid in relevant), 0.0) if relevant else None
    dcg = sum((2 ** judgments.get(pid, 0) - 1) / math.log2(rank + 1)
              for rank, pid in enumerate(top, 1))
    ideal = sum((2 ** grade - 1) / math.log2(rank + 1)
                for rank, grade in enumerate(sorted(judgments.values(), reverse=True)[:k], 1))
    return {'recall': recall, 'mrr': rr, 'ndcg': dcg / ideal if ideal else None,
            'judged_coverage': sum(pid in judgments for pid in top) / len(top) if top else None,
            'relevant_total': len(relevant), 'returned': len(top)}


def percentile(values, q):
    if not values:
        return None
    values = sorted(values)
    position = (len(values) - 1) * q
    lo, hi = math.floor(position), math.ceil(position)
    return values[lo] + (values[hi] - values[lo]) * (position - lo)
