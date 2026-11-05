"""Deterministic content + Bayesian rating ranking. No behavioral reads or writes."""
import json
import logging
import math
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from app.core.geo import distance_km
from .eligibility import display_identity, eligible_for_request
from .place_document import DOCUMENT_VERSION
from .profiles import build_interests
from .ranking import bayesian_quality
from .schemas import RecommendationResponse

logger = logging.getLogger(__name__)


def recommend_content_rating(service, request, *, now=None, log=True):
    now = now or datetime.now(timezone.utc)
    config = service.config
    rows = service.store.places()
    # Only explicit preferences (request or saved settings) and the current query.
    # Empty aggregates guarantee existing interaction history cannot build a profile.
    profile = build_interests(service.embedding, request, rows, {}, service.store,
                              service.model, config.max_interest_groups)
    profile = profile if profile.queries else None
    priors = defaultdict(list)
    places = [(row, json.loads(row["data"])) for row in rows]
    for _, place in places:
        if (place["active"] and eligible_for_request(place, request)
                and place["rating"] is not None and place["review_count"] > 0):
            priors[(place["city"].casefold(), place["place_type"])].append(
                (place["rating"], place["review_count"]))
    means = {key: sum(r * n for r, n in values) / sum(n for _, n in values)
             for key, values in priors.items()}
    candidates = []
    service_excluded = 0
    excluded = set(request.exclude_place_ids)
    for row, place in places:
        if not place["active"] or place["place_id"] in excluded:
            continue
        if request.city and place["city"].casefold() != request.city.casefold():
            continue
        if request.place_type and place["place_type"] != request.place_type:
            continue
        if request.category and request.category.casefold() not in {c.casefold() for c in place["categories"]}:
            continue
        if request.budget and (place["budget"] or "").casefold() != request.budget.casefold():
            continue
        if request.family_friendly is not None and place["family_friendly"] is not request.family_friendly:
            continue
        distance = None
        if request.latitude is not None and place["latitude"] is not None:
            distance = distance_km(request.latitude, request.longitude, place["latitude"], place["longitude"])
        if request.radius_km is not None and (distance is None or distance > request.radius_km):
            continue
        if not eligible_for_request(place, request):
            service_excluded += 1
            continue
        mean = means.get((place["city"].casefold(), place["place_type"]), 3.5)
        quality = bayesian_quality(place["rating"], place["review_count"], mean, config.prior_strength)
        candidates.append({"row": row, "place": place, "quality": quality, "distance": distance})

    retrieval = "quality_fallback" if profile is None else "qdrant"
    if profile is not None and candidates:
        try:
            retrieved = set()
            limit = max(1, math.ceil(config.candidate_limit / len(profile.queries)))
            for vector in profile.queries:
                retrieved.update(service.content.candidates(vector, request, service.model, limit))
            retrieved.intersection_update(c["place"]["place_id"] for c in candidates)
            if not retrieved:
                retrieval = "local_exact"
        except Exception:
            logger.warning("Qdrant unavailable; using exact content-rating retrieval", exc_info=True)
            retrieved = set()
            retrieval = "local_exact"
        if retrieval == "qdrant":
            # Rating and pending-index sources remain eligible even if ANN omitted them.
            pool = retrieved | {c["place"]["place_id"] for c in sorted(
                candidates, key=lambda c: (-c["quality"], c["place"]["place_id"]))[:100]}
            pool.update(c["place"]["place_id"] for c in candidates if not c["row"]["indexed"])
            candidates = [c for c in candidates if c["place"]["place_id"] in pool]

    warnings = []
    if request.exclude_seen:
        warnings.append("exclude_seen chưa áp dụng trong chế độ nội dung + rating; dùng exclude_place_ids để loại rõ địa điểm.")
    if request.exploration:
        warnings.append("Khám phá chưa áp dụng trong chế độ nội dung + rating; kết quả được xếp hạng xác định.")
    items = []
    missing_vectors = 0
    for candidate in candidates:
        place, row = candidate["place"], candidate["row"]
        content = profile.score(service._vector(row)) if profile is not None else None
        if profile is not None and content is None:
            missing_vectors += 1
        parts = {"quality": (candidate["quality"], config.quality_weight)}
        if content is not None:
            parts["content"] = ((content + 1) / 2, config.content_weight)
        total = sum(weight for _, weight in parts.values())
        weights = {key: weight / total for key, (_, weight) in parts.items()}
        score = sum(parts[key][0] * weight for key, weight in weights.items())
        reasons = []
        if content is not None:
            reasons.append("Xếp hạng theo độ tương đồng BGE-M3 với nhu cầu và sở thích khai báo")
        reasons.append("Điểm chất lượng Bayesian từ rating và số lượt đánh giá" if place["rating"] is not None
                       and place["review_count"] > 0 else "Chưa có đủ rating/lượt đánh giá; dùng mức chất lượng tham chiếu")
        item = {"place_id": place["place_id"], "name": place["name"], "place_type": place["place_type"],
                "city": place["city"], "score": score, "content_score": content,
                "quality_score": candidate["quality"], "distance_score": None,
                "distance_km": candidate["distance"], "collaborative_score": None,
                "effective_weights": weights, "repeat_penalty": 0, "is_exploration": False,
                "image_url": place["image_url"], "rating": place["rating"],
                "review_count": place["review_count"], "reasons": reasons}
        items.append((item, display_identity(place)))
    if missing_vectors:
        warnings.append(f"{missing_vectors} ứng viên chưa có vector đúng phiên bản; chỉ dùng điểm rating cho các mục này.")
    selected, identities = [], set()
    suppressed = 0
    for item, identity in sorted(items, key=lambda pair: (-pair[0]["score"], pair[0]["place_id"])):
        if identity in identities:
            suppressed += 1
            continue
        identities.add(identity)
        if len(selected) < request.limit:
            selected.append(item)
    result = RecommendationResponse(
        request_id=str(uuid.uuid4()), user_id=request.user_id, total=len(selected),
        strategy="content_rating" if profile is not None else "rating_fallback",
        model_version=service.version, retrieval=retrieval, recommendations=selected,
        warnings=warnings, diagnostics={"mode": "content_rating", "interest_groups": len(profile.groups) if profile else 0,
            "profile_confidence": profile.confidence if profile else 0, "collaborative_active": False,
            "history_used": False, "distance_scoring": False, "candidate_count": len(candidates),
            "service_only_excluded": service_excluded, "same_name_suppressed": suppressed,
            "document_version": DOCUMENT_VERSION, "score_is_probability": False,
            "rating_source": "place.rating + place.review_count", "rating_prior_strength": config.prior_strength}
    ).model_dump(mode="json")
    if log:
        # Request auditing only. This does not record interactions or visible exposures.
        service.store.log_impression(result, now.isoformat())
    return result
