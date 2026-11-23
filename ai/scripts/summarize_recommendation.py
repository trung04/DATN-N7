"""Tabulate measured results and paired bootstrap intervals over profiles, not repeated calls."""
from collections import defaultdict
import json
import hashlib
from pathlib import Path
import sys
import numpy as np


def analyze(folder):
    folder=Path(folder)
    report=json.loads((folder/'summary.json').read_text(encoding='utf-8'))
    root=Path(__file__).resolve().parents[1]
    files=['app/modules/recommendation/'+name for name in
           ['content_baselines.py','content_rating.py','profiles.py','personalized.py','ranking.py']]
    files.append('scripts/evaluate_recommendation.py')
    report['implementation_hashes']={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}
    (folder/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    runs=[json.loads(line) for line in (folder/'runs.jsonl').read_text(encoding='utf-8').splitlines() if line]
    for r in report['reports']:
        r['successful_requests']=sum(run['method']==r['method'] for run in runs)
        r['failed_requests']=0  # Runner aborts before writing a report if any request fails.
    (folder/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    by_case=defaultdict(list)
    for r in runs:by_case[(r['method'],r['cohort'],r['case_id'])].append(r)
    pairs=[('semantic','tfidf'),('content_rating','semantic'),('personalized_mmr','content_rating')]
    comparisons=[]
    for cohort in ('cold','warm'):
        for a,b in pairs:
            ids=sorted(case for method,c,case in by_case if method==a and c==cohort)
            for metric in ('ndcg','recall','ild'):
                differences=[]
                for case in ids:
                    def mean(method):
                        values=[r['metrics']['10'][metric] for r in by_case[(method,cohort,case)] if r['metrics']['10'][metric] is not None]
                        return np.mean(values) if values else None
                    left,right=mean(a),mean(b)
                    if left is not None and right is not None:differences.append(left-right)
                if not differences:continue
                rng=np.random.default_rng(42);values=np.array(differences)
                boot=np.mean(rng.choice(values,size=(2000,len(values)),replace=True),axis=1)
                lo,hi=np.quantile(boot,[.025,.975])
                comparisons.append({'cohort':cohort,'a':a,'b':b,'metric_at_10':metric,
                    'profiles':len(values),'mean_difference':float(np.mean(values)),
                    'paired_bootstrap_95_ci':[float(lo),float(hi)],'resamples':2000,'seed':42})
    (folder/'paired-comparisons.json').write_text(json.dumps(comparisons,indent=2)+'\n',encoding='utf-8')
    lines=['# Recommendation benchmark — measured provisional results','',
        f"Profiles: {report['profile_count']}; repeats: {report['repeats']}. Silver labels and simulated history; not real-user evidence.",'']
    for cohort in ('cold','warm'):
        lines+=['## '+cohort,'','| Method | Precision@10 | Recall@10 | MRR@10 | nDCG@10 | ILD@10 | Catalog coverage@10 |',
                '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
        for r in report['reports']:
            m=next(m for m in r['quality_metrics'] if m['cohort']==cohort and m['k']==10)
            values=[f"{m[k]:.4f}" if m[k] is not None else 'N/A' for k in ('precision','recall','mrr','ndcg','ild','catalog_coverage')]
            lines.append('| '+r['method']+' | '+' | '.join(values)+' |')
        lines.append('')
    lines+=['## Runtime','','| Method | Mean ms | P95 ms | Shared-process RSS peak MiB |', '| --- | ---: | ---: | ---: |']
    for r in report['reports']:
        lines.append(f"| {r['method']} | {r['latency_ms']['mean']:.2f} | {r['latency_ms']['p95']:.2f} | {r['resources']['rss_sampled_peak_mib']:.2f} |")
    lines+=['','Latency is in-process and includes preference embedding; HTTP/model startup/TF-IDF fit excluded after warmup. RAM belongs to shared process, not independent method footprint. See summary.json for protocol.',
        '', 'Paired confidence intervals: paired-comparisons.json; 2,000 resamples over profiles within each cohort. Repeated calls are not independent users. Intervals are exploratory, unadjusted for multiple comparisons.',
        '', 'Do not choose a production winner solely from synthetic silver labels. TF-IDF can benefit from lexical-rule label bias; MMR trades ranking relevance for diversity. Validate labels and collect real interactions before claiming personalization efficacy.']
    (folder/'comparison.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('\n'.join(lines))


if __name__=='__main__':analyze(sys.argv[1])
