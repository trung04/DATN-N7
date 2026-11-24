"""Frozen simulated profiles + held-out items; silver relevance, never human-ground truth."""
import csv
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import statistics
import math
import numpy as np


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def training_item(pid):
    return int(hashlib.sha256(('recommendation-v1:'+pid).encode()).hexdigest()[:8],16)%3==0


def build_dataset(folder,source,catalog):
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    labels=defaultdict(dict)
    with (source/'judgments.csv').open(encoding='utf-8-sig',newline='') as f:
        for row in csv.DictReader(f):labels[row['query_id']][row['place_id']]=int(row['grade'])
    queries=[json.loads(line) for line in (source/'queries.jsonl').read_text(encoding='utf-8').splitlines() if line]
    by_id={p['place_id']:p for p in catalog};cases=[];judgments={};skipped=[]
    for q in queries:
        if not q.get('criteria'):continue  # Entity-name lookup is not a user-interest recommendation task.
        scope={pid:grade for pid,grade in labels[q['query_id']].items() if pid in by_id
               and by_id[pid]['active'] and by_id[pid]['city']==q['filters']['city']
               and by_id[pid]['place_type']==q['filters']['place_type']}
        train=sorted(pid for pid in scope if training_item(pid))
        held={pid:g for pid,g in scope.items() if not training_item(pid)}
        positive=[pid for pid in train if scope[pid]>=2]
        if not positive or not any(g>=2 for g in held.values()):
            skipped.append(q['query_id']);continue
        judgments[q['query_id']]=held
        for cohort in ('cold','warm'):
            history=[{'event_id':f"eval-{q['query_id']}-{pid}",'place_id':pid,'action':'save','active':True,
                      'occurred_at':'2026-01-01T00:00:00Z'} for pid in positive[:3]] if cohort=='warm' else []
            cases.append({'case_id':q['query_id']+'-'+cohort,'judgment_id':q['query_id'],'cohort':cohort,
                'preferences':[q['query']],'filters':q['filters'],'exclude_place_ids':train,
                'history':history,'split':q['split']})
    if not cases:raise ValueError('No eligible recommendation profiles')
    (folder/'catalog.jsonl').write_text(''.join(json.dumps(p,ensure_ascii=False)+'\n' for p in catalog),encoding='utf-8')
    (folder/'profiles.jsonl').write_text(''.join(json.dumps(p,ensure_ascii=False)+'\n' for p in cases),encoding='utf-8')
    with (folder/'judgments.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.writer(f);writer.writerow(['judgment_id','place_id','grade','review_status'])
        for qid,values in sorted(judgments.items()):
            for pid,grade in sorted(values.items()):writer.writerow([qid,pid,grade,'draft_silver'])
    manifest={'version':'recommendation-v1','created_at':datetime.now(timezone.utc).isoformat(),
        'catalog_hash':digest(catalog),'catalog_count':len(catalog),'case_count':len(cases),
        'cohorts':{'cold':len(cases)//2,'warm':len(cases)//2},'skipped_queries':skipped,
        'label_status':'draft_silver_simulated_profiles_NOT_real_users',
        'source_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source.iterdir()) if p.is_file()},
        'protocol':'SHA256 item split ~1/3 history-only, ~2/3 evaluation-only; identical candidates for cold/warm and every method; max 3 positive save events from history partition; never score history items; no parameter tuning on test.'}
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return manifest


def load_dataset(folder,catalog):
    manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    if digest(catalog)!=manifest['catalog_hash']:raise ValueError('Catalog changed; build a new version, do not overwrite benchmark silently')
    cases=[json.loads(line) for line in (folder/'profiles.jsonl').read_text(encoding='utf-8').splitlines() if line]
    judgments=defaultdict(dict)
    with (folder/'judgments.csv').open(encoding='utf-8',newline='') as f:
        for row in csv.DictReader(f):
            grade=int(row['grade']);qid=row['judgment_id'];pid=row['place_id']
            if grade not in range(4) or pid in judgments[qid]:raise ValueError('Invalid/duplicate relevance judgment')
            judgments[qid][pid]=grade
    for case in cases:
        ids=set(judgments[case['judgment_id']]);history={e['place_id'] for e in case['history']}
        if history & ids or not history<=set(case['exclude_place_ids']):raise ValueError('History/test leakage')
    return manifest,cases,judgments


def quality(ids,judgments,k,vectors):
    if len(set(ids))!=len(ids):raise ValueError('Duplicate ranking IDs')
    top=ids[:k];positives={pid for pid,g in judgments.items() if g>=2}
    hits=sum(pid in positives for pid in top)
    ideal=sum((2**g-1)/math.log2(i+2) for i,g in enumerate(sorted(judgments.values(),reverse=True)[:k]))
    dcg=sum((2**judgments.get(pid,0)-1)/math.log2(i+2) for i,pid in enumerate(top))
    distances=[float((1-np.clip(np.dot(vectors[a],vectors[b]),-1,1))/2)
               for i,a in enumerate(top) for b in top[i+1:] if a in vectors and b in vectors]
    return {'precision':hits/k,'recall':hits/len(positives) if positives else None,
        'mrr':next((1/(i+1) for i,pid in enumerate(top) if pid in positives),0.) if positives else None,
        'ndcg':dcg/ideal if ideal else None,'ild':statistics.mean(distances) if distances else None,
        'judged_coverage':sum(pid in judgments for pid in top)/len(top) if top else None,
        'returned':len(top),'relevant_total':len(positives)}


def percentile(values,q):
    if not values:return None
    ordered=sorted(values);position=(len(ordered)-1)*q;lo=math.floor(position);hi=math.ceil(position)
    return ordered[lo]+(ordered[hi]-ordered[lo])*(position-lo)
