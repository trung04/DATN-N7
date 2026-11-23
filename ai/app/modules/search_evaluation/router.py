from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import threading
import time
import uuid
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import Field, StrictInt
from app.api.dependencies import service
from app.core.auth import authorize
from app.modules.recommendation.schemas import Contract, Identifier, Text
from app.modules.semantic_search.schemas import PlaceSearchRequest
from .metrics import ranking_metrics
from .metrics import percentile
import statistics

router=APIRouter(prefix='/api/v1/search-evaluations',tags=['Search evaluation'],dependencies=[Depends(authorize)])


class EvaluationQuery(Contract):
    query: str = Field(min_length=1,max_length=2000)
    city: Text | None = None
    place_type: Literal['Hotel','Restaurant','Attraction'] | None = None
    k: int = Field(10,ge=1,le=100)


class LabelUpdate(Contract):
    expected_version: int = Field(ge=1)
    labels: dict[Identifier,StrictInt | None] = Field(max_length=200)


def memory():
    try:
        data={}
        for line in Path('/proc/self/status').read_text().splitlines():
            if line.startswith(('VmRSS:','VmHWM:')):
                key,value,*_=line.split();data[key.rstrip(':')]=int(value)/1024
        return data
    except OSError:return {}


@router.post('')
def run_evaluation(body: EvaluationQuery,svc=Depends(service)):
    from app.agents.place_search_agent import PlaceSearchAgent
    with svc.lock:
        corpus=[json.loads(r['data']) for r in svc.store.places()]
        corpus=[p for p in corpus if p['active'] and (not body.city or p['city'].casefold()==body.city.casefold())
                and (not body.place_type or p['place_type']==body.place_type)]
        request=PlaceSearchRequest(query=body.query,filters={'city':body.city,'place_type':body.place_type},infer_filters=False,limit=body.k)
        samples=[memory()];stop=threading.Event()
        def monitor():
            while not stop.wait(.05):samples.append(memory())
        thread=threading.Thread(target=monitor,daemon=True);thread.start()
        start=time.perf_counter()
        try:result=PlaceSearchAgent(svc).search(request)
        finally:elapsed=(time.perf_counter()-start)*1000;stop.set();thread.join(timeout=1);samples.append(memory())
        device=svc.embedding.device
        resources={'device':device,'rss_baseline_mib':samples[0].get('VmRSS'),
                   'rss_sampled_peak_mib':max((s['VmRSS'] for s in samples if 'VmRSS' in s),default=None),
                   'rss_lifetime_high_water_mib':samples[-1].get('VmHWM'),
                   'vram_allocated_mib':None,'vram_status':'not_used_cpu' if str(device)=='cpu' else 'unavailable',
                   'sampling_interval_ms':50}
        torch=sys.modules.get('torch')
        if str(device).startswith('cuda') and torch is not None:
            resources.update(vram_allocated_mib=torch.cuda.memory_allocated(device)/2**20,vram_status='current_allocation_not_peak')
        corpus.sort(key=lambda p:(p['name'].casefold(),p['place_id']))
        data={'id':str(uuid.uuid4()),'version':1,'created_at':datetime.now(timezone.utc).isoformat(),
              'query':body.query,'filters':request.filters.model_dump(mode='json',exclude_none=True),'k':body.k,
              'ranking':result['results'],'retrieval':result['retrieval'],'model':result['model'],
              'warnings':result['warnings'],'latency_ms':elapsed,'resources':resources,
              'corpus':[{k:p.get(k) for k in ['place_id','name','city','place_type','description','categories','tags','amenities','image_url','image_urls']} for p in corpus],
              'labels':{},'label_source':'human_ui'}
        svc.store.create_evaluation(data)
    return data


@router.get('')
def list_evaluations(svc=Depends(service)):
    return {'items':svc.store.evaluation_list()}


@router.get('/reports/aggregate')
def aggregate_evaluations(svc=Depends(service)):
    latest={}
    for d in svc.store.evaluations_for_report():
        signature=json.dumps([d['query'],d['filters'],d['k']],sort_keys=True,ensure_ascii=False)
        if signature not in latest:latest[signature]=d
    complete=[d for d in latest.values() if len(d['labels'])==len(d['corpus']) and d['corpus']]
    result={}
    for k in sorted({5,10,20,*[d['k'] for d in complete]}):
        metrics=[ranking_metrics([r['place_id'] for r in d['ranking']],d['labels'],k) for d in complete if d['k']>=k]
        if not metrics:continue
        row={'query_count':len(metrics)}
        for name in ['recall','mrr','ndcg']:
            values=[m[name] for m in metrics if m[name] is not None]
            row[name]=statistics.mean(values) if values else None;row[name+'_query_count']=len(values)
        result[str(k)]=row
    latencies=[d['latency_ms'] for d in complete]
    return {'complete_queries':len(complete),'incomplete_queries_excluded':len(latest)-len(complete),
            'metrics':result,'latency_ms':{'mean':statistics.mean(latencies) if latencies else None,'p95':percentile(latencies,.95)},
            'scope':'Latest saved session per query + filters + K; at most 500 recent sessions scanned; only fully labeled nonempty scopes included.'}


@router.get('/{evaluation_id}')
def get_evaluation(evaluation_id:Identifier,svc=Depends(service)):
    return svc.store.evaluation(evaluation_id)


@router.patch('/{evaluation_id}/labels')
def save_labels(evaluation_id:Identifier,body:LabelUpdate,svc=Depends(service)):
    if any(g is not None and g not in range(4) for g in body.labels.values()):raise ValueError('Grade must be 0..3')
    return svc.store.save_evaluation_labels(evaluation_id,body.expected_version,body.labels)


@router.get('/{evaluation_id}/metrics')
def evaluate_labels(evaluation_id:Identifier,svc=Depends(service)):
    data=svc.store.evaluation(evaluation_id)
    ids=[r['place_id'] for r in data['ranking']]
    if any(pid not in data['labels'] for pid in ids):raise ValueError('Label all returned Top K places before computing metrics')
    complete=len(data['labels'])==len(data['corpus'])
    return {'evaluation_id':evaluation_id,'version':data['version'],'complete_scope':complete,
            'judged':len(data['labels']),'scope':len(data['corpus']),
            'metrics':{str(k):ranking_metrics(ids,data['labels'],k) for k in sorted({5,10,20,data['k']}) if k<=data['k']},
            'latency_ms':data['latency_ms'],'resources':data['resources'],
            'warning':None if complete else 'Nhãn chưa phủ toàn bộ phạm vi. Recall và nDCG chỉ tạm tính trên tập đã gán nhãn, chưa phải kết quả đánh giá đầy đủ.'}
