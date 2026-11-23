"""Pure content baselines sharing factual documents, filters and explicit-interest policy."""
from datetime import datetime, timezone
import hashlib
import json
import uuid
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from app.core.geo import distance_km
from app.modules.semantic_search.text_utils import folded, STOPWORDS
from .eligibility import display_identity, eligible_for_request
from .place_document import place_document
from .profiles import build_explicit_profile
from .schemas import RecommendationResponse


class TfidfIndex:
    def __init__(self, rows):
        self.vectorizer=TfidfVectorizer(preprocessor=folded,token_pattern=r'\b\w+\b',
            stop_words=sorted(STOPWORDS),ngram_range=(1,2),sublinear_tf=True,smooth_idf=True,norm='l2')
        self.ids=[r['id'] for r in rows]
        self.matrix=self.vectorizer.fit_transform([place_document(json.loads(r['data'])) for r in rows])
        self.positions={pid:i for i,pid in enumerate(self.ids)}

    def embed_text(self,text):
        return self.vectorizer.transform([text]).toarray()[0]

    def scores(self,profile):
        if not profile.queries:return None
        best=None
        if profile.groups:
            values=np.asarray(self.matrix @ np.stack(profile.groups,axis=1))
            top=max(profile.weights) or 1
            best=np.max(values-np.array([.2*(1-w/top) for w in profile.weights]),axis=1)
        if profile.query is not None:
            query=np.asarray(self.matrix @ profile.query).ravel()
            best=query if best is None else .7*query+.3*best
        return np.clip(best,-1,1)


def eligible_rows(service,request):
    result=[];excluded=set(request.exclude_place_ids)
    for row in service.store.places():
        p=json.loads(row['data'])
        if not p['active'] or p['place_id'] in excluded or not eligible_for_request(p,request):continue
        if request.city and p['city'].casefold()!=request.city.casefold():continue
        if request.place_type and p['place_type']!=request.place_type:continue
        if request.category and request.category.casefold() not in {c.casefold() for c in p['categories']}:continue
        if request.budget and (p['budget'] or '').casefold()!=request.budget.casefold():continue
        if request.family_friendly is not None and p['family_friendly'] is not request.family_friendly:continue
        distance=None
        if request.latitude is not None and p['latitude'] is not None:
            distance=distance_km(request.latitude,request.longitude,p['latitude'],p['longitude'])
        if request.radius_km is not None and (distance is None or distance>request.radius_km):continue
        result.append((row,p,distance))
    return result


def recommend_baseline(service,request,*,now=None,log=True):
    now=now or datetime.now(timezone.utc)
    candidates=eligible_rows(service,request);warnings=[];items=[];index=None
    if request.mode=='tfidf':
        rows=[r for r in service.store.places() if json.loads(r['data'])['active']]
        signature=hashlib.sha256(''.join(r['data'] for r in rows).encode()).hexdigest()
        cached=getattr(service,'_tfidf_index',None)
        if rows and (cached is None or cached[0]!=signature):service._tfidf_index=(signature,TfidfIndex(rows))
        index=service._tfidf_index[1] if rows else None
        profile=build_explicit_profile(index,request,service.store,service.config.max_interest_groups) if index else None
        scores=index.scores(profile) if index and profile else None
    else:
        profile=build_explicit_profile(service.embedding,request,service.store,service.config.max_interest_groups)
        scores=None
    if profile is None or not profile.queries:
        warnings.append('Chưa có sở thích/nhu cầu biểu diễn được; baseline nội dung thuần không tự dùng rating hoặc hành vi.')
    else:
        missing=0
        for row,p,distance in candidates:
            if index:score=float(scores[index.positions[p['place_id']]]) if scores is not None else None
            else:score=profile.score(service._vector(row))
            if score is None:missing+=1;continue
            items.append({'place_id':p['place_id'],'name':p['name'],'city':p['city'],'place_type':p['place_type'],
                'score':score,'content_score':score,'quality_score':0.,'rating':p['rating'],'review_count':p['review_count'],
                'image_url':p['image_url'],'distance_km':distance,'effective_weights':{'content':1.},
                'reasons':['Cosine TF-IDF thuần' if index else 'Cosine BGE-M3 thuần; không cộng rating/hành vi/MMR']})
        if missing:warnings.append(f'{missing} địa điểm không có vector hợp lệ; không tham gia baseline nội dung.')
    items.sort(key=lambda p:(-p['score'],p['place_id']))
    selected=[];seen=set();by_id={p['place_id']:p for _,p,_ in candidates}
    for item in items:
        identity=display_identity(by_id[item['place_id']])
        if identity not in seen:seen.add(identity);selected.append(item)
        if len(selected)>=request.limit:break
    result=RecommendationResponse(request_id=str(uuid.uuid4()),user_id=request.user_id,total=len(selected),
        strategy=request.mode,model_version=service.version+'-'+request.mode,retrieval='local_exact',recommendations=selected,
        warnings=warnings,diagnostics={'mode':request.mode,'requested_mode':request.mode,'history_used':False,
            'rating_used':False,'mmr_applied':False,'candidate_count':len(candidates),'score_is_probability':False,
            'content_representation':'tfidf-word-1-2' if index else service.model}).model_dump(mode='json')
    if log:service.store.save_recommendation(result,now.isoformat())
    return result
