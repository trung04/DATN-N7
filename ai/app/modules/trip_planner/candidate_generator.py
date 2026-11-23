import json
from app.modules.semantic_search.schemas import PlaceSearchRequest, SearchFilters
from app.modules.semantic_search.text_utils import folded
from app.modules.recommendation.schemas import RecommendationRequest
from .candidate_ranker import rank_candidate
from .preference_analyzer import PreferenceAnalyzer
from app.modules.recommendation.eligibility import service_only
from app.tools.semantic_search_tool import semantic_search
from app.tools.recommendation_tool import recommend

class CandidateGenerator:
    def __init__(self,rec):
        self.rec=rec
    def generate(self, req, required=None, excluded=None, query=None):
        rows = {r["id"]:json.loads(r["data"]) for r in self.rec.store.places()}
        excluded = set(req.excluded_place_ids) | set(excluded or [])
        required = set(req.required_place_ids if required is None else required)
        missing = [pid for pid in required if pid not in rows]
        if req.selected_place_ids:
            selected=set(req.selected_place_ids)
            if not required<=selected:raise ValueError('All required places must be in selected_place_ids when a selection is supplied')
            if selected-set(rows):raise ValueError('Selected place does not exist')
        if missing:
            raise ValueError("Địa điểm bắt buộc không tồn tại: "+", ".join(sorted(missing)))
        blocked = [pid for pid in required if pid in excluded or not rows[pid]["active"] or
                   folded(rows[pid]["city"]) != folded(req.city) or rows[pid]["place_type"] not in req.include_types or
                   rows[pid]["latitude"] is None or rows[pid]["longitude"] is None]
        if blocked:
            raise ValueError("Địa điểm bắt buộc bị loại, sai thành phố/loại hoặc thiếu tọa độ: "+", ".join(sorted(blocked)))
        query = PreferenceAnalyzer.query(req,self.rec.store,query)
        scores = {}
        for kind in req.include_types:
            search = semantic_search(self.rec,PlaceSearchRequest(query=query, infer_filters=False,
                filters=SearchFilters(city=req.city,place_type=kind,exclude_place_ids=list(excluded)),limit=80))
            recommended = recommend(self.rec,RecommendationRequest(user_id=req.user_id,city=req.city,
                place_type=kind,preferences=req.preferences,query=query,limit=80,
                exclude_place_ids=list(excluded),mode='personalized_mmr',refresh_variety=False))
            rec_scores = {p["place_id"]:p["score"] for p in recommended["recommendations"]}
            for rank, result in enumerate(search["results"],1):
                pid = result["place_id"]
                p = rows[pid]
                if p["latitude"] is None or p["longitude"] is None or (service_only(p) and pid not in required):
                    continue
                scores[pid] = rank_candidate(rank,rec_scores.get(pid,0),p["rating"])
        for pid in required:
            scores.setdefault(pid,0.5)
        if req.selected_place_ids:
            scores={pid:scores.get(pid,.5) for pid in req.selected_place_ids if pid not in excluded and rows[pid]['active']
                    and folded(rows[pid]['city'])==folded(req.city) and rows[pid]['place_type'] in req.include_types
                    and rows[pid]['latitude'] is not None and rows[pid]['longitude'] is not None}
            if len(scores)!=len(req.selected_place_ids):raise ValueError('Selected place is inactive, filtered or missing coordinates')
        ordered = sorted(scores,key=lambda pid:(-int(pid in required),-scores[pid],pid))[:max(req.candidate_limit,len(required))]
        return [{"place":rows[pid],"score":scores[pid],"required":pid in required} for pid in ordered]
