"""Evaluate /search/places against frozen judgments; measure HTTP latency and server memory."""
import argparse
from collections import defaultdict, Counter
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
from pathlib import Path
import statistics
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from evaluation.metrics import ranking_metrics, percentile


def server_memory(container):
    code="""import json
from pathlib import Path
s={}
for line in Path('/proc/1/status').read_text().splitlines():
 if line.startswith(('VmRSS:','VmHWM:')):
  key,value,*_=line.split();s[key.rstrip(':')]=int(value)*1024
p=Path('/sys/fs/cgroup/memory.current')
if p.exists():s['container_memory_bytes']=int(p.read_text())
print(json.dumps(s))"""
    result=subprocess.run(['docker','exec',container,'python','-c',code],capture_output=True,timeout=8,check=True)
    return {**json.loads(result.stdout),'sample_time':datetime.now(timezone.utc).isoformat()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset',default='ai/evaluation/datasets/place-search-v1')
    parser.add_argument('--base-url',default='http://127.0.0.1:9002')
    parser.add_argument('--output',required=True)
    parser.add_argument('--method',choices=['hybrid','bge','bm25'],default='hybrid')
    parser.add_argument('--ks',default='5,10,20')
    parser.add_argument('--repeats',type=int,default=3)
    parser.add_argument('--warmup',type=int,default=2)
    parser.add_argument('--split',choices=['all','validation','test'],default='all')
    parser.add_argument('--allow-draft',action='store_true')
    parser.add_argument('--max-queries',type=int)
    parser.add_argument('--container',default='datn-n7-ai-1')
    parser.add_argument('--skip-resources',action='store_true')
    args=parser.parse_args()
    ks=sorted(set(int(k) for k in args.ks.split(',')))
    if not ks or min(ks)<1 or max(ks)>100 or args.repeats<1 or args.warmup<0:
        parser.error('K must be 1..100, repeats>=1, warmup>=0')
    if args.max_queries is not None and args.max_queries<1:parser.error('max-queries must be positive')
    folder=Path(args.dataset);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    queries=[json.loads(line) for line in (folder/'queries.jsonl').read_text(encoding='utf-8').splitlines() if line]
    if len({q['query_id'] for q in queries})!=len(queries):raise ValueError('Duplicate query ID')
    queries=[q for q in queries if args.split=='all' or q['split']==args.split]
    if args.max_queries:queries=queries[:args.max_queries]
    if not queries:raise ValueError('No queries selected')
    qids={q['query_id'] for q in queries};judgments=defaultdict(dict);draft_count=0
    with (folder/'judgments.csv').open(encoding='utf-8-sig',newline='') as f:
        for row in csv.DictReader(f):
            if row['query_id'] not in qids:continue
            grade=int(row['grade'])
            if grade not in range(4):raise ValueError('Grade must be 0..3')
            qid,pid=row['query_id'],row['place_id']
            if pid in judgments[qid]:raise ValueError('Duplicate judgment')
            judgments[qid][pid]=grade
            draft_count+=row['review_status']!='reviewed'
    if any(not judgments[q['query_id']] for q in queries):raise ValueError('Missing query judgments')
    if draft_count and not args.allow_draft:
        raise ValueError('Draft labels present. Review them, or explicitly use --allow-draft for a provisional report.')
    key=os.getenv('RECOMMENDATION_API_KEY') or os.getenv('AI_SERVICE_API_KEY')
    envfile=Path(__file__).resolve().parents[2]/'.env'
    if not key and envfile.exists():
        for line in envfile.read_text(encoding='utf-8').splitlines():
            if line.startswith('AI_SERVICE_API_KEY='):key=line.split('=',1)[1].strip().strip('\"\'')
    def call(path,body=None):
        headers={'Content-Type':'application/json'}
        if key:headers['X-API-Key']=key
        if path=='/api/v1/search/places' and body is not None:body={**body,'method':args.method}
        request=Request(args.base_url.rstrip('/')+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with urlopen(request,timeout=180) as response:return json.load(response)
    health=call('/health');ready=call('/ready')
    stop=threading.Event();samples=[];resource_errors=[];gpu_samples=[]
    nvidia=shutil.which('nvidia-smi')
    def sample():
        try:samples.append(server_memory(args.container))
        except Exception as exc:resource_errors.append(type(exc).__name__)
        if nvidia:
            try:
                result=subprocess.run([nvidia,'--query-gpu=index,memory.used','--format=csv,noheader,nounits'],
                                      capture_output=True,text=True,timeout=8,check=True)
                for line in result.stdout.splitlines():
                    index,memory=line.split(',');gpu_samples.append({'gpu_index':int(index.strip()),'used_mib':float(memory.strip())})
            except Exception as exc:resource_errors.append('GPU_'+type(exc).__name__)
    def monitor():
        while not stop.wait(1):sample()
    if not args.skip_resources:sample()
    monitor_thread=threading.Thread(target=monitor,daemon=True)
    if not args.skip_resources:monitor_thread.start()
    runs=[];warmups=[]
    try:
        for n in range(args.warmup):
            q=queries[n%len(queries)];start=time.perf_counter()
            call('/api/v1/search/places',{'query':q['query'],'filters':q['filters'],'infer_filters':q['infer_filters'],'limit':max(ks)})
            warmups.append((time.perf_counter()-start)*1000)
        for q in queries:
            for repeat in range(args.repeats):
                start=time.perf_counter();error=None;result={}
                try:
                    result=call('/api/v1/search/places',{'query':q['query'],'filters':q['filters'],
                                                       'infer_filters':q['infer_filters'],'limit':max(ks)})
                    ids=[p['place_id'] for p in result['results']]
                    if len(ids)!=len(set(ids)):raise ValueError('Duplicate IDs')
                except Exception as exc:
                    error=f'HTTP_{exc.code}' if isinstance(exc,HTTPError) else type(exc).__name__;ids=[]
                elapsed=(time.perf_counter()-start)*1000
                runs.append({'query_id':q['query_id'],'query':q['query'],'category':q['category'],'repeat':repeat+1,
                             'latency_ms':elapsed,'error':error,'ids':ids,'retrieval':result.get('retrieval'),
                             'warnings':result.get('warnings',[]),'applied_filters':result.get('applied_filters'),
                             'metrics':{str(k):ranking_metrics(ids,judgments[q['query_id']],k) for k in ks}})
            print(f"{q['query_id']} done ({len(runs)}/{len(queries)*args.repeats} requests)",flush=True)
    finally:
        stop.set()
        if not args.skip_resources:
            monitor_thread.join(timeout=10);sample()
    rows=[]
    for category in ['all']+sorted({q['category'] for q in queries}):
        subset=[r for r in runs if category=='all' or r['category']==category]
        for k in ks:
            row={'category':category,'k':k,'queries':len({r['query_id'] for r in subset})}
            for metric in ['recall','mrr','ndcg','judged_coverage']:
                # Average repeats within query, then macro-average across queries.
                values=defaultdict(list)
                for run in subset:
                    value=run['metrics'][str(k)][metric]
                    if value is not None:values[run['query_id']].append(value)
                row[metric]=statistics.mean(statistics.mean(v) for v in values.values()) if values else None
                row[metric+'_query_count']=len(values)
            rows.append(row)
    successes=[r['latency_ms'] for r in runs if not r['error']]
    errors=[r for r in runs if r['error']]
    resources={'scope':'AI API process PID 1 RSS; container cgroup memory includes other process/cache memory',
               'sampling_interval_seconds':1,'samples':len(samples),'errors':sorted(set(resource_errors)),
               'rss_baseline_mib':samples[0].get('VmRSS',0)/2**20 if samples else None,
               'rss_sampled_peak_mib':max(s.get('VmRSS',0) for s in samples)/2**20 if samples else None,
               'rss_lifetime_high_water_mib':max(s.get('VmHWM',0) for s in samples)/2**20 if samples else None,
               'container_sampled_peak_mib':max(s.get('container_memory_bytes',0) for s in samples)/2**20 if samples else None,
               'vram_mib':None,'vram_status':'not_used_by_text_embedding_cpu' if health.get('device')=='cpu' else 'not_instrumented',
               'gpu_device_global_peak_mib':{str(gpu):max(s['used_mib'] for s in gpu_samples if s['gpu_index']==gpu)
                                             for gpu in {s['gpu_index'] for s in gpu_samples}},
               'gpu_scope':'nvidia-smi global physical-device used memory; includes other projects/display, NOT AI-only VRAM',
               'note':'Sampled peak can miss short spikes; HWM is since process start, not this evaluation only. Qdrant RAM excluded.'}
    summary={'created_at':datetime.now(timezone.utc).isoformat(),'method':args.method,'provisional_labels':bool(draft_count),
             'draft_judgments':draft_count,'query_count':len(queries),'repeats':args.repeats,'split':args.split,
             'dataset_hashes':{name:hashlib.sha256((folder/name).read_bytes()).hexdigest() for name in ['corpus.jsonl','queries.jsonl','judgments.csv','manifest.json']},
             'health':health,'ready':ready,'endpoint':'/api/v1/search/places','request_limit':max(ks),
             'retrieval_modes':dict(Counter(r['retrieval'] for r in runs)),
             'quality_metrics':rows,'failed_requests':len(errors),'successful_requests':len(successes),
             'latency_ms':{'mean':statistics.mean(successes) if successes else None,'p50':percentile(successes,.5),
                           'p95':percentile(successes,.95),'max':max(successes) if successes else None,
                           'scope':'Warm HTTP end-to-end for max(K); serial requests; warmup excluded; includes HTTP/serialization/network'},
             'warmup_ms':warmups,'resources':resources,
             'caveats':['Silver labels require human validation; scores are not final thesis results.',
                        'Binary relevance grade >=2; nDCG gain=2^grade-1; unjudged IDs count as grade 0 and coverage is reported.',
                        'Queries without binary positives excluded from Recall/MRR; failures get empty ranks (zero quality where defined).',
                        'Method is recorded explicitly: BM25, exact BGE cosine, or hybrid RRF. No exact-name boost in pure methods.',
                        'Resource polling adds small measurement overhead. No model startup/cold-load latency included.']}
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'runs.jsonl').write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in runs)+'\n',encoding='utf-8')
    (out/'resources.jsonl').write_text('\n'.join(json.dumps(r) for r in samples)+'\n',encoding='utf-8')
    with (out/'metrics.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    per_query=[]
    for q in queries:
        selected=[r for r in runs if r['query_id']==q['query_id']]
        row={'query_id':q['query_id'],'query':q['query'],'category':q['category'],
             'mean_latency_ms':statistics.mean(r['latency_ms'] for r in selected),'failed_requests':sum(bool(r['error']) for r in selected)}
        for k in ks:
            for metric in ['recall','mrr','ndcg','judged_coverage']:
                values=[r['metrics'][str(k)][metric] for r in selected if r['metrics'][str(k)][metric] is not None]
                row[f'{metric}@{k}']=statistics.mean(values) if values else None
        per_query.append(row)
    with (out/'per-query.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(per_query[0]));writer.writeheader();writer.writerows(per_query)
    print(json.dumps({'queries':len(queries),'failed_requests':len(errors),'latency_ms':summary['latency_ms'],
                      'all_metrics':[r for r in rows if r['category']=='all'],'resources':resources,'output':str(out)},ensure_ascii=False))
    if errors:raise SystemExit(1)


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
