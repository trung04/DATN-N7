"""Bounded multi-interest profile with explicit query precedence."""
import json
from dataclasses import dataclass,field
import numpy as np
from app.core.vectors import normalize

@dataclass
class InterestProfile:
    groups:list=field(default_factory=list)
    weights:list=field(default_factory=list)
    query:object=None
    confidence:float=0.0
    @property
    def queries(self):return ([self.query] if self.query is not None else [])+self.groups
    def score(self,vector):
        if vector is None or not self.queries:return None
        top=max(self.weights,default=1) or 1
        best=max((float(np.dot(g,vector))-.2*(1-w/top) for g,w in zip(self.groups,self.weights)),default=None)
        if self.query is not None:
            q=float(np.dot(self.query,vector));best=q if best is None else .7*q+.3*best
        return float(np.clip(best,-1,1))

def build_interests(embedding,request,rows,aggregated,store,model,max_groups=3):
    preferences=request.preferences if request.preferences is not None else store.preferences(request.user_id)
    seeds=[]
    for text in dict.fromkeys(preferences or []):
        v=normalize(embedding.embed_text(text))
        if v is not None:seeds.append((v,1.0))
    explicit=bool(seeds); valid={r['id']:r for r in rows};history=[];mass=0.0
    signals=sorted(((pid,w) for (uid,pid),w in aggregated.items() if uid==request.user_id),key=lambda x:(-x[1],x[0]))[:100]
    for pid,weight in signals:
        row=valid.get(pid)
        if not row or row['model']!=model or not row['content_hash'] or not row['vector']:continue
        p=json.loads(row['data'])
        if not p['active'] or (request.place_type and p['place_type']!=request.place_type):continue
        v=normalize(json.loads(row['vector']))
        if v is None or len(v)!=embedding.dimensions:continue
        history.append((v,weight));mass+=weight
    h=.6*mass/(mass+5) if explicit else 1.0
    seeds=[(v,(1-h)/max(1,len(seeds))) for v,_ in seeds]
    seeds.extend((v,h*w/mass) for v,w in history if mass>0)
    groups=[];weights=[]
    for v,w in seeds:
        sims=[float(np.dot(v,g)) for g in groups];i=int(np.argmax(sims)) if sims else -1
        if i>=0 and sims[i]>=.92:
            groups[i]=normalize(groups[i]*weights[i]+v*w);weights[i]+=w
        else:groups.append(v);weights.append(w)
    chosen=sorted(range(len(groups)),key=lambda i:(-weights[i],i))[:max_groups]
    query=normalize(embedding.embed_text(request.query)) if request.query else None
    return InterestProfile([groups[i] for i in chosen],[weights[i] for i in chosen],query,
                           1.0 if explicit or query is not None else mass/(mass+5))
