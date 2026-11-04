import json
import numpy as np
from .profiles import build_interests
from app.core.vectors import normalize
from app.modules.semantic_search.vector_repository import PlaceVectorRepository

ContentBasedRecommender = PlaceVectorRepository

class UserProfileBuilder:
    def __init__(self, embedding):
        self.embedding=embedding
    def build(self, request, rows, aggregated, store, model):
        # Legacy callers may request a centroid; runtime v2 uses separate groups.
        profile=build_interests(self.embedding,request,rows,aggregated,store,model)
        return normalize(np.mean(profile.queries,axis=0)) if profile.queries else None
