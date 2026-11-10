"""Group explicit preferences; keep the current query separate. No user history."""
from dataclasses import dataclass, field
import numpy as np
from app.core.vectors import normalize


@dataclass
class InterestProfile:
    groups: list = field(default_factory=list)
    weights: list = field(default_factory=list)
    query: object = None

    @property
    def queries(self):
        return ([self.query] if self.query is not None else []) + self.groups

    def score(self, vector):
        if vector is None or not self.queries:
            return None
        top = max(self.weights, default=1) or 1
        best = max((float(np.dot(group, vector)) - .2 * (1 - weight / top)
                    for group, weight in zip(self.groups, self.weights)), default=None)
        if self.query is not None:
            query_score = float(np.dot(self.query, vector))
            best = query_score if best is None else .7 * query_score + .3 * best
        return float(np.clip(best, -1, 1))


def build_explicit_profile(embedding, request, store, max_groups=3):
    preferences = request.preferences if request.preferences is not None else store.preferences(request.user_id)
    groups, weights = [], []
    for text in dict.fromkeys(preferences or []):
        vector = normalize(embedding.embed_text(text))
        if vector is None:
            continue
        similarities = [float(np.dot(vector, group)) for group in groups]
        index = int(np.argmax(similarities)) if similarities else -1
        if index >= 0 and similarities[index] >= .92:
            groups[index] = normalize(groups[index] * weights[index] + vector)
            weights[index] += 1
        else:
            groups.append(vector)
            weights.append(1.0)
    chosen = sorted(range(len(groups)), key=lambda index: (-weights[index], index))[:max_groups]
    query = normalize(embedding.embed_text(request.query)) if request.query else None
    return InterestProfile([groups[index] for index in chosen], [weights[index] for index in chosen], query)
