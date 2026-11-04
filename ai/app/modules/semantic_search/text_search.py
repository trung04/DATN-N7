from .schemas import SearchFilters, PlaceSearchRequest, PlaceSearchItem, PlaceSearchResponse
from .text_utils import folded, contains, negative_before, feature_key, place_features, FEATURES, TYPES, STOPWORDS
"""Vietnamese place search: conservative constraints + BM25 + exact BGE cosine + RRF.

This is rule-based parsing, not an LLM. Unsupported requirements are surfaced rather
than claimed satisfied. Search never reads user history or adds exploratory results.
"""
import json
import math
import re
import unicodedata
import uuid
from collections import Counter
from typing import Literal

import numpy as np
from fastapi import APIRouter, Depends, Request
from pydantic import Field, model_validator

from app.core.auth import authorize
from app.modules.recommendation.content_based import normalize
from app.modules.recommendation.schemas import Contract, Identifier, Text
from app.modules.recommendation.hybrid_service import distance_km


def interpret(body, catalog):
    text = folded(body.query)
    inferred, warnings = {}, []
    if body.infer_filters:
        cities = sorted({p["city"] for p in catalog}, key=lambda x: (-len(x), x))
        found = []
        for city in cities:
            name = folded(city)
            # A location needs a locative phrase, not just a city in a hotel name.
            match = re.search(r"\b(?:o|tai|thanh pho)\s+" + re.escape(name) + r"\b", text)
            if match and not negative_before(text, match.start()):
                found.append(city)
        if len(found) == 1:
            inferred["city"] = found[0]
        elif len(found) > 1:
            warnings.append("Có nhiều thành phố trong câu; hãy chọn filters.city")
        elif re.search(r"\b(?:o|tai|thanh pho)\s+", text):
            warnings.append("Chưa nhận diện chắc chắn thành phố từ catalog; gửi filters.city để lọc bắt buộc")
        kinds = []
        for kind, aliases in TYPES.items():
            if any((m := re.search(r"\b" + re.escape(alias) + r"\b", text)) and
                   not negative_before(text, m.start()) for alias in aliases):
                kinds.append(kind)
        if len(kinds) == 1:
            inferred["place_type"] = kinds[0]
        elif len(kinds) > 1:
            warnings.append("Có nhiều loại địa điểm trong câu; hãy chọn filters.place_type")
        positive, negative = [], []
        for key, aliases in FEATURES.items():
            matches = [m for alias in aliases for m in re.finditer(r"\b" + re.escape(alias) + r"\b", text)]
            for m in matches:
                if re.search(r"\b(?:khong can|khong bat buoc|uu tien)(?:\s+\w+){0,2}\s*$", text[max(0,m.start()-35):m.start()]):
                    warnings.append(f"{key} được giữ như ưu tiên nội dung, không chuyển thành bộ lọc bắt buộc")
                    continue
                target = negative if negative_before(text, m.start()) else positive
                if key not in target:
                    target.append(key)
        if contains(text, "hoac") and positive:
            warnings.append("Chưa chuyển điều kiện tiện ích có 'hoặc' thành bộ lọc; hãy gửi filters rõ ràng")
        elif positive:
            inferred["amenities"] = positive
        if negative:
            inferred["excluded_amenities"] = negative
    applied = dict(inferred)
    explicit = body.filters.model_dump(exclude_unset=True)
    for key, value in explicit.items():
        if key in inferred and value != inferred[key]:
            warnings.append(f"filters.{key} được ưu tiên hơn điều kiện nhận diện trong câu")
        # Explicit empty/null can clear an inferred field.
        applied[key] = value
    result = SearchFilters.model_validate(applied)
    unsupported = []
    if result.excluded_amenities:
        unsupported.append("Tiện ích loại trừ chỉ kiểm tra dữ liệu đã ghi nhận; chưa chứng minh danh sách tiện ích đầy đủ hoặc tiện ích thực sự không tồn tại")
    patterns = [
        (r"\b(?:trieu|nghin|vnd|dong|gia re|gia phong|ngan sach)\b", "Giá cụ thể chưa có dữ liệu để kiểm chứng; budget chỉ là nhãn nếu backend cung cấp"),
        (r"\b(?:gan bien|ven bien|cach bien)\b", "Gần biển chỉ được tìm theo nội dung, chưa xác minh khoảng cách tới bờ biển"),
        (r"\b(?:dang mo|mo cua|toi nay|hom nay)\b", "Chưa xác minh lịch mở cửa và tình trạng hoạt động theo thời gian"),
        (r"\b(?:gia dinh|tre nho|tre em)\b", "Nhu cầu gia đình được tìm theo nội dung; muốn bắt buộc hãy gửi filters.family_friendly"),
        (r"\b(?:gan toi|gan day)\b", "Gần vị trí của bạn cần filters.latitude, longitude và radius_km"),
        (r"\b[1-5]\s*sao\b", "Số sao chưa được diễn giải thành hạng khách sạn hoặc rating; dùng filters.min_rating cho điểm review"),
    ]
    for pattern, message in patterns:
        if re.search(pattern, text):
            if "Gần vị trí" in message and result.latitude is not None and result.radius_km is not None:
                continue
            if "gia đình" in message and result.family_friendly is not None:
                continue
            unsupported.append(message)
    if "khong" in text or "tranh" in text:
        warnings.append("Phủ định chỉ được xử lý cho các tiện ích nhận diện; điều kiện phủ định khác cần bộ lọc rõ ràng")
    return result, inferred, warnings, unsupported


def bm25(query, documents):
    terms = set(folded(query).split()) - STOPWORDS
    counts = [Counter(folded(doc).split()) for doc in documents]
    average = sum(sum(c.values()) for c in counts) / max(1, len(counts)) or 1
    scores = [0.0] * len(documents)
    for term in terms:
        df = sum(term in c for c in counts)
        idf = math.log(1 + (len(counts) - df + 0.5) / (df + 0.5))
        for index, count in enumerate(counts):
            tf = count[term]
            if tf:
                scores[index] += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * sum(count.values()) / average))
    return scores


class PlaceSearchService:
    def __init__(self, recommendation):
        self.catalog = recommendation

    def search(self, body):
        rows = self.catalog.store.places()
        catalog = [json.loads(row["data"]) for row in rows]
        filters, inferred, warnings, unsupported = interpret(body, catalog)
        query_vector = None
        if rows:
            query_vector = normalize(self.catalog.embedding.embed_text(body.query))
            if query_vector is None:
                warnings.append("Embedding truy vấn rỗng; chỉ tìm theo từ khóa")
        eligible, documents = [], []
        stale = 0
        for row, p in zip(rows, catalog):
            if not p["active"] or p["place_id"] in filters.exclude_place_ids:
                continue
            if filters.city and folded(p["city"]) != folded(filters.city):
                continue
            if filters.place_type and p["place_type"] != filters.place_type:
                continue
            if filters.category and folded(filters.category) not in {folded(c) for c in p["categories"]}:
                continue
            if filters.budget and folded(p["budget"] or "") != folded(filters.budget):
                continue
            if filters.family_friendly is not None and p["family_friendly"] is not filters.family_friendly:
                continue
            if filters.min_rating is not None and (p["rating"] is None or p["rating"] < filters.min_rating):
                continue
            features = place_features(p)
            if not {feature_key(x) for x in filters.amenities} <= features:
                continue
            if filters.excluded_amenities:
                # Empty amenities are unknown, never proof that an excluded facility is absent.
                if not p["amenities"] or {feature_key(x) for x in filters.excluded_amenities} & features:
                    continue
            distance = None
            if filters.latitude is not None and p["latitude"] is not None:
                distance = distance_km(filters.latitude, filters.longitude, p["latitude"], p["longitude"])
            if filters.radius_km is not None and (distance is None or distance > filters.radius_km):
                continue
            vector = None
            if row["vector"] and row["model"] == self.catalog.model and row["content_hash"]:
                vector = np.asarray(json.loads(row["vector"]), dtype=np.float32)
                if vector.shape != (self.catalog.embedding.dimensions,) or not np.all(np.isfinite(vector)):
                    vector = None
            if vector is None:
                stale += 1
            eligible.append({"p": p, "vector": vector, "distance": distance})
            documents.append(" ".join([p["name"]] * 3 + p["categories"] + p["tags"] + p["amenities"] +
                                      [(p["description"] or "")[:4000], p["city"]]))
        lexical = bm25(body.query, documents)
        valid = [(i,c["vector"]) for i,c in enumerate(eligible) if c["vector"] is not None]
        similarities = {}
        if query_vector is not None and valid:
            values = np.clip(np.stack([v for _,v in valid]) @ query_vector, -1, 1)
            similarities = {i: float(value) for (i,_), value in zip(valid, values)}
        semantic_rank = {i: rank for rank,(i,_) in enumerate(sorted(similarities.items(), key=lambda x: (-x[1], eligible[x[0]]["p"]["place_id"])), 1)}
        lexical_rank = {i: rank for rank,i in enumerate(sorted((i for i,v in enumerate(lexical) if v > 0),
            key=lambda i: (-lexical[i], eligible[i]["p"]["place_id"])), 1)}
        results = []
        for i, c in enumerate(eligible):
            similarity = similarities.get(i)
            if body.min_similarity is not None and (similarity is None or similarity < body.min_similarity):
                continue
            if i not in semantic_rank and i not in lexical_rank:
                continue
            exact_name = folded(body.query) == folded(c["p"]["name"])
            score = sum(1 / (60 + ranks[i]) for ranks in (semantic_rank, lexical_rank) if i in ranks)
            reasons = []
            if exact_name:
                reasons.append("Tên địa điểm khớp chính xác")
            if lexical[i] > 0:
                reasons.append("Khớp từ khóa trong tên hoặc nội dung")
            if similarity is not None:
                reasons.append("Đã xếp hạng theo độ tương đồng ngữ nghĩa BGE")
            results.append({"place_id": c["p"]["place_id"], "name": c["p"]["name"],
                "place_type": c["p"]["place_type"], "city": c["p"]["city"], "score": score,
                "semantic_score": similarity, "keyword_score": lexical[i], "exact_name_match": exact_name,
                "distance_km": c["distance"], "image_url": c["p"]["image_url"], "reasons": reasons})
        results.sort(key=lambda r: (-int(r["exact_name_match"]), -r["score"], r["place_id"]))
        if stale:
            warnings.append(f"{stale} địa điểm chưa có embedding đúng model/nội dung; chỉ tham gia nguồn từ khóa")
        if not results:
            warnings.append("Không có kết quả; không tự nới các điều kiện bắt buộc")
        return {"request_id": str(uuid.uuid4()), "query": body.query, "parser": "vietnamese_rules_v1",
            "inferred_filters": inferred, "applied_filters": filters.model_dump(mode="json", exclude_none=True),
            "unsupported_requirements": unsupported, "warnings": warnings,
            "retrieval": "local_exact_bge_bm25_rrf", "model": self.catalog.model,
            "total": len(results), "offset": body.offset, "limit": body.limit,
            "results": results[body.offset:body.offset+body.limit]}

