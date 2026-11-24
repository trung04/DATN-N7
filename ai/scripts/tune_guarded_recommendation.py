"""Select only on validation; test is excluded from this parameter selection."""
import argparse
import csv
import itertools
import json
from pathlib import Path
import sqlite3
import statistics
import sys
import tempfile
import time
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from evaluation.recommendation_benchmark import load_dataset,quality,percentile,digest
from app.database.sqlite import Store
from app.modules.recommendation.service import RecommendationService
from app.modules.recommendation.schemas import RecommendationRequest,InteractionEvent
from app.modules.recommendation.personalized import guarded_mmr
from app.modules.recommendation.place_document import place_document
import hashlib
from app.modules.semantic_search.embedding_service import EmbeddingService
from qdrant_client import QdrantClient


class CachedEmbedding:
    def __init__(self,encoder):self.encoder=encoder;self.cache={}
    def __getattr__(self,key):return getattr(self.encoder,key)
    def embed_text(self,text):
        if text not in self.cache:self.cache[text]=self.encoder.embed_text(text)
        return self.cache[text]


def main():
    root=Path(__file__).resolve().parents[1]
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog-db',required=True)
    parser.add_argument('--output',type=Path,default=root/'evaluation/results/recommendation-guarded-v1')
    parser.add_argument('--repeats',type=int,default=3)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    if args.repeats<1:parser.error('repeats must be positive')
    dataset=root/'evaluation/datasets/recommendation-v1'
    catalog=[json.loads(line) for line in (dataset/'catalog.jsonl').read_text(encoding='utf-8').splitlines()]
    manifest,cases,judgments=load_dataset(dataset,catalog)
    validation=[c for c in cases if c['split']=='validation' and c['cohort']=='warm']
    test=[c for c in cases if c['split']=='test' and c['cohort']=='warm']
    ids={p['place_id'] for p in catalog}
    with sqlite3.connect('file:'+str(Path(args.catalog_db).resolve())+'?mode=ro&immutable=1',uri=True) as db:
        db.row_factory=sqlite3.Row;rows=[dict(r) for r in db.execute('SELECT * FROM places ORDER BY id') if r['id'] in ids]
    if len(rows)!=len(ids):raise ValueError('Snapshot does not contain frozen catalog')
    if digest([json.loads(r['data']) for r in rows])!=manifest['catalog_hash']:
        raise ValueError('Source catalog content differs from frozen dataset')
    encoder=EmbeddingService();cached=CachedEmbedding(encoder)
    with tempfile.TemporaryDirectory() as temp:
        store=Store(Path(temp)/'tuning.sqlite3')
        with store.connection() as db:
            for r in rows:db.execute('INSERT INTO places VALUES(?,?,?,?,?,?)',tuple(r[k] for k in ['id','data','vector','content_hash','model','indexed']))
        qdrant=QdrantClient(':memory:');svc=RecommendationService(store,cached,qdrant)
        svc.content.candidates=lambda *_:ids
        vectors={r['id']:svc._vector(r) for r in rows}
        if any(v is None for v in vectors.values()):raise ValueError('Invalid catalog vectors')
        if any(hashlib.sha256((svc.model+place_document(json.loads(r['data']))).encode()).hexdigest()!=r['content_hash'] for r in rows):
            raise ValueError('Vectors do not match frozen factual documents')
        for c in cases:
            for e in c['history']:store.save_interaction(c['case_id'],InteractionEvent.model_validate(e))
        def request(c,mode='personalized_mmr',**extra):
            return RecommendationRequest(user_id=c['case_id'],mode=mode,preferences=c['preferences'],
                **c['filters'],exclude_place_ids=c['exclude_place_ids'],refresh_variety=False,**extra)
        def metrics(c,items,k=10):
            return quality([i['place_id'] for i in items],judgments[c['judgment_id']],k,vectors)
        baseline={c['case_id']:metrics(c,svc.recommend(request(c,mode='semantic',limit=20),log=False)['recommendations']) for c in validation}
        pools={}
        for alpha,weight in itertools.product([.5,.7,.9],[.8,.9,.95]):
            for c in validation:
                pools[(c['case_id'],alpha,weight)]=svc.recommend(request(c,limit=100,preference_alpha=alpha,
                    personalized_content_weight=weight,mmr_lambda=1,mmr_relevance_tolerance=0),log=False)['recommendations']
            print('validation pools',alpha,weight,flush=True)
        grid=[]
        for alpha,weight,lamb,tolerance in itertools.product([.5,.7,.9],[.8,.9,.95],[.5,.7,.85,.95],[0,.005,.01,.02]):
            values=[metrics(c,guarded_mmr(pools[(c['case_id'],alpha,weight)],vectors,20,lamb,tolerance)) for c in validation]
            base=list(baseline.values())
            feasible=(statistics.mean(v['ndcg'] for v in values)>=.99*statistics.mean(v['ndcg'] for v in base)
                and statistics.mean(v['recall'] for v in values)>=.99*statistics.mean(v['recall'] for v in base)
                and all(v['ndcg']>=baseline[c['case_id']]['ndcg']-.03 and v['recall']>=baseline[c['case_id']]['recall']-.03 for c,v in zip(validation,values)))
            grid.append({'preference_alpha':alpha,'personalized_content_weight':weight,'mmr_lambda':lamb,
                'mmr_relevance_tolerance':tolerance,'feasible':feasible,
                **{k:statistics.mean(v[k] for v in values) for k in ['ndcg','recall','ild']}})
        feasible=[r for r in grid if r['feasible']]
        if not feasible:raise ValueError('No safe configuration on validation; do not tune using test')
        selected=max(feasible,key=lambda r:(r['ild'],r['ndcg'],r['recall'],-r['mmr_relevance_tolerance']))
        params={k:selected[k] for k in ['preference_alpha','personalized_content_weight','mmr_lambda','mmr_relevance_tolerance']}
        selection={'parameters':params,'validation_profiles':len(validation),'selection':selected,
            'policy':'Max validation ILD subject to >=99% semantic mean nDCG/Recall and per-profile losses <=0.03; no test labels used',
            'dataset_catalog_hash':manifest['catalog_hash']}
        selection['dataset_hashes']={name:hashlib.sha256((dataset/name).read_bytes()).hexdigest() for name in ['catalog.jsonl','profiles.jsonl','judgments.csv','manifest.json']}
        # Persist the choice BEFORE any test ranking is evaluated.
        (args.output/'selected-config.json').write_text(json.dumps(selection,indent=2)+'\n',encoding='utf-8')
        with (args.output/'validation-grid.csv').open('w',newline='',encoding='utf-8') as f:
            writer=csv.DictWriter(f,fieldnames=list(grid[0]));writer.writeheader();writer.writerows(grid)
        svc.embedding=encoder  # No cached embedding timings for the held-out test run.
        runs=[];reports=[]
        for method in ['semantic','legacy_personalized','guarded_personalized']:
            elapsed=[];method_runs=[]
            for c in test:
                for repeat in range(args.repeats):
                    body=request(c,mode='semantic',limit=20) if method=='semantic' else request(c,limit=20,
                        diversity_policy='legacy' if method=='legacy_personalized' else 'guarded',
                        **({'preference_alpha':.5,'mmr_lambda':.7} if method=='legacy_personalized' else params))
                    start=time.perf_counter();result=svc.recommend(body,log=False);ms=(time.perf_counter()-start)*1000
                    ranked=result['recommendations']
                    if not {i['place_id'] for i in ranked}<=set(judgments[c['judgment_id']]):raise ValueError('History/test leakage')
                    run={'method':method,'case_id':c['case_id'],'repeat':repeat+1,'latency_ms':ms,
                        'ids':[i['place_id'] for i in ranked], 'metrics':{str(k):metrics(c,ranked,k) for k in [5,10,20]}}
                    runs.append(run);method_runs.append(run);elapsed.append(ms)
                print('test',method,c['case_id'],'done',flush=True)
            reports.append({'method':method,'profiles':len(test),'quality_metrics':[
                {'k':k,**{key:statistics.mean(r['metrics'][str(k)][key] for r in method_runs) for key in ['precision','recall','mrr','ndcg','ild']}}
                for k in [5,10,20]],'latency_ms':{'mean':statistics.mean(elapsed),'p95':percentile(elapsed,.95)}})
        comparisons=[]
        for reference in ['semantic','legacy_personalized']:
            for metric in ['ndcg','recall','ild']:
                differences=[]
                for c in test:
                    means={m:statistics.mean(r['metrics']['10'][metric] for r in runs if r['method']==m and r['case_id']==c['case_id']) for m in [reference,'guarded_personalized']}
                    differences.append(means['guarded_personalized']-means[reference])
                rng=np.random.default_rng(42);boot=np.mean(rng.choice(differences,size=(2000,len(differences)),replace=True),axis=1)
                comparisons.append({'a':'guarded_personalized','b':reference,'metric_at_10':metric,
                    'difference':statistics.mean(differences),'paired_bootstrap_95_ci':np.quantile(boot,[.025,.975]).tolist()})
        result={'selection':selection,'split':'test','cohort':'warm','test_profiles':len(test),'repeats':args.repeats,
            'reports':reports,'paired_comparisons':comparisons,'caveat':'Silver labels, 5 validation/17 held-out test simulated users; do not claim real-user correctness. In-process latency includes BGE preference embedding; no HTTP.'}
        result['protocol_note']='Exploratory: only 5 validation profiles for 144 configurations. Test excluded from current parameter selection; earlier aggregate benchmark already included these test profiles, so this is not a fresh unseen confirmation set.'
        result['source_catalog_and_vector_hashes_verified']=True
        result['successful_test_requests']=len(reports)*len(test)*args.repeats
        (args.output/'summary.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        (args.output/'runs.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in runs),encoding='utf-8')
        print(json.dumps(result),flush=True);qdrant.close()


if __name__=='__main__':main()
