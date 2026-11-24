"""Compare pure TF-IDF/BGE, rating, content+rating and personalized+MMR on one held-out benchmark."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import statistics
import sys
import tempfile
import threading
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from evaluation.recommendation_benchmark import build_dataset,load_dataset,quality,percentile
from app.database.sqlite import Store
from app.modules.recommendation.schemas import RecommendationRequest,InteractionEvent
from app.modules.recommendation.service import RecommendationService
from app.modules.recommendation.place_document import place_document
from app.modules.recommendation.eligibility import service_only
from app.modules.semantic_search.embedding_service import EmbeddingService
from qdrant_client import QdrantClient


def memory():
    values={}
    for line in Path('/proc/self/status').read_text().splitlines():
        if line.startswith(('VmRSS:','VmHWM:')):
            key,value,*_=line.split();values[key.rstrip(':')]=int(value)/1024
    return values


def main():
    root=Path(__file__).resolve().parents[1]
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog-db',required=True)
    parser.add_argument('--dataset',type=Path,default=root/'evaluation/datasets/recommendation-v1')
    parser.add_argument('--output',type=Path,default=root/'evaluation/results/recommendation-v1')
    parser.add_argument('--source',type=Path,default=root/'evaluation/sources/place-search-v1')
    parser.add_argument('--build-dataset',action='store_true')
    parser.add_argument('--allow-draft',action='store_true')
    parser.add_argument('--repeats',type=int,default=3)
    parser.add_argument('--split',choices=['all','validation','test'],default='all')
    args=parser.parse_args()
    if args.repeats<1:parser.error('repeats must be positive')
    ids={json.loads(line)['place_id'] for line in (args.source/'corpus.jsonl').read_text(encoding='utf-8').splitlines() if line}
    with sqlite3.connect('file:'+str(Path(args.catalog_db).resolve())+'?mode=ro&immutable=1',uri=True) as source:
        source.row_factory=sqlite3.Row
        rows=[dict(row) for row in source.execute('SELECT * FROM places ORDER BY id') if row['id'] in ids]
    rows=[r for r in rows if not service_only(json.loads(r['data']))]
    catalog=[json.loads(r['data']) for r in rows]
    if args.build_dataset:
        if (args.dataset/'manifest.json').exists():raise ValueError('Dataset already frozen; choose a new directory/version')
        build_dataset(args.dataset,args.source,catalog)
    manifest,cases,judgments=load_dataset(args.dataset,catalog)
    with (args.dataset/'judgments.csv').open(encoding='utf-8',newline='') as f:
        draft_count=sum(row['review_status']!='reviewed' for row in csv.DictReader(f))
    if draft_count and not args.allow_draft:raise ValueError('Draft labels present; review them or explicitly pass --allow-draft')
    cases=[c for c in cases if args.split=='all' or c['split']==args.split]
    if not cases:raise ValueError('No profiles for requested split')
    args.output.mkdir(parents=True,exist_ok=True)
    load_start=time.perf_counter();embedding=EmbeddingService();model_load_ms=(time.perf_counter()-load_start)*1000
    with tempfile.TemporaryDirectory() as temp:
        store=Store(Path(temp)/'evaluation.sqlite3')
        with store.connection() as db:
            for row in rows:
                db.execute('INSERT INTO places(id,data,vector,content_hash,model,indexed) VALUES(?,?,?,?,?,?)',
                    tuple(row[k] for k in ['id','data','vector','content_hash','model','indexed']))
        qdrant=QdrantClient(':memory:')
        svc=RecommendationService(store,embedding,qdrant)
        # Common full candidate pool isolates ranking, rather than comparing different ANN recall.
        svc.content.candidates=lambda *_:set(r['id'] for r in rows)
        vectors={};reembedded=0
        for row in rows:
            expected=hashlib.sha256((svc.model+place_document(json.loads(row['data']))).encode()).hexdigest()
            vector=svc._vector(row)
            if expected!=row['content_hash'] or vector is None:
                vector=embedding.embed_text(place_document(json.loads(row['data'])))
                row.update(vector=json.dumps(vector),model=svc.model,content_hash=expected)
                with store.connection() as db:
                    db.execute('UPDATE places SET vector=?,model=?,content_hash=? WHERE id=?',
                               (row['vector'],row['model'],row['content_hash'],row['id']))
                vector=svc._vector(row);reembedded+=1
                if vector is None:raise ValueError('Encoder returned invalid vector')
            vectors[row['id']]=vector
        for c in cases:
            uid='eval-'+c['case_id']
            for e in c['history']:store.save_interaction(uid,InteractionEvent.model_validate({**e,'event_id':uid+'-'+e['event_id']}))
        runs=[];summaries=[]
        for method in ['rating_only','tfidf','semantic','content_rating','personalized_mmr']:
            def request(c):
                return RecommendationRequest(user_id='eval-'+c['case_id'],mode='content_rating' if method=='rating_only' else method,
                    preferences=[] if method=='rating_only' else c['preferences'],**c['filters'],
                    exclude_place_ids=c['exclude_place_ids'],limit=20,refresh_variety=False,diversity_policy='legacy',mmr_lambda=.7,preference_alpha=.5)
            start=time.perf_counter();svc.recommend(request(cases[0]),log=False);warmup_ms=(time.perf_counter()-start)*1000
            stop=threading.Event();samples=[memory()]
            def monitor():
                while not stop.wait(.05):samples.append(memory())
            thread=threading.Thread(target=monitor,daemon=True);thread.start();method_runs=[]
            try:
                for c in cases:
                    for repeat in range(args.repeats):
                        start=time.perf_counter();result=svc.recommend(request(c),log=False);elapsed=(time.perf_counter()-start)*1000
                        ranked=[p['place_id'] for p in result['recommendations']]
                        if not set(ranked)<=set(judgments[c['judgment_id']]):raise ValueError('Ranking includes history/out-of-scope items')
                        run={'method':method,'case_id':c['case_id'],'cohort':c['cohort'],'repeat':repeat+1,
                            'latency_ms':elapsed,'ids':ranked,'metrics':{str(k):quality(ranked,judgments[c['judgment_id']],k,vectors) for k in [5,10,20]}}
                        method_runs.append(run)
                    print(method,c['case_id'],'done',flush=True)
            finally:stop.set();thread.join(timeout=1);samples.append(memory())
            runs.extend(method_runs)
            metrics=[]
            for cohort in ['all','cold','warm']:
                subset=[r for r in method_runs if cohort=='all' or r['cohort']==cohort]
                for k in [5,10,20]:
                    m={'cohort':cohort,'k':k,'profiles':len({r['case_id'] for r in subset})}
                    for key in ['precision','recall','mrr','ndcg','ild','judged_coverage']:
                        values=[r['metrics'][str(k)][key] for r in subset if r['metrics'][str(k)][key] is not None]
                        m[key]=statistics.mean(values) if values else None
                    covered={pid for r in subset for pid in r['ids'][:k]}
                    available={pid for c in cases if cohort=='all' or c['cohort']==cohort for pid in judgments[c['judgment_id']]}
                    m['catalog_coverage']=len(covered)/len(available) if available else None
                    metrics.append(m)
            latencies=[r['latency_ms'] for r in method_runs]
            summaries.append({'method':method,'quality_metrics':metrics,'warmup_ms':warmup_ms,
                'latency_ms':{'mean':statistics.mean(latencies),'p50':percentile(latencies,.5),'p95':percentile(latencies,.95),'max':max(latencies)},
                'resources':{'rss_baseline_mib':samples[0].get('VmRSS'),'rss_sampled_peak_mib':max(s.get('VmRSS',0) for s in samples),
                    'rss_lifetime_high_water_mib':samples[-1].get('VmHWM'),'vram_mib':0,'device':'cpu','sampling_interval_ms':50,
                    'scope':'Shared sequential benchmark process contains BGE and TF-IDF; NOT independent algorithm RAM. CPU encoders do not allocate VRAM.'}})
        qdrant.close()
    report={'created_at':datetime.now(timezone.utc).isoformat(),'dataset':manifest,'split':args.split,
        'dataset_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in args.dataset.iterdir() if p.is_file()},
        'profile_count':len(cases),'repeats':args.repeats,'embedding_model':embedding.model_name,'model_load_ms':model_load_ms,
        'reembedded_places_in_temporary_database':reembedded,'draft_judgments':draft_count,
        'reports':summaries,'protocol':{'latency':'In-process end-to-end recommendation; includes preference embedding, filtering, ranking, formatting; excludes model startup, TF-IDF fit after warmup, HTTP/network; log=False',
            'candidate_pool':'Identical held-out catalog, full-scan for every method; no ANN truncation; remove history items and service-only categories',
            'personalized':'Fixed alpha=0.5, lambda=0.7, pool=100; rotation disabled; simulated history, not real interactions',
            'labels':'Silver catalog-rule labels reused across all methods; lexical-rule bias possible, human review required; no claim of real-user personalization efficacy'}}
    (args.output/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output/'runs.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in runs),encoding='utf-8')
    metric_rows=[{'method':s['method'],**m} for s in summaries for m in s['quality_metrics']]
    with (args.output/'metrics.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(metric_rows[0]));writer.writeheader();writer.writerows(metric_rows)
    print(json.dumps({'profiles':len(cases),'methods':len(summaries),'output':str(args.output)}),flush=True)


if __name__=='__main__':main()
