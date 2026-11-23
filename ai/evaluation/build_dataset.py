"""Frozen silver labels from catalog facts, independent of search/model ranking."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import unicodedata


def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.casefold().replace('đ','d'))
                   if unicodedata.category(c) != 'Mn')


# Query, city, type, required feature groups. AND between groups; OR within a group.
TOPICS = [
 ('Tìm bãi biển để tắm và nghỉ ngơi','Đà Nẵng','Attraction',[['bãi biển','bãi tắm','beach']]),
 ('Tham quan những ngôi chùa Phật giáo','Đà Nẵng','Attraction',[['chùa','phật giáo']]),
 ('Tìm bảo tàng để khám phá văn hóa lịch sử','Đà Nẵng','Attraction',[['bảo tàng','museum']]),
 ('Công viên để đi dạo thư giãn','Đà Nẵng','Attraction',[['công viên','park']]),
 ('Khám phá thác nước và cảnh quan thiên nhiên','Đà Nẵng','Attraction',[['thác nước','thác','waterfall']]),
 ('Tham quan các cây cầu','Đà Nẵng','Attraction',[['cầu','bridge']]),
 ('Điểm ngắm cảnh trên núi','Đà Nẵng','Attraction',[['núi','mountain','đỉnh']]),
 ('Di tích và kiến trúc cổ ở Hội An','Hội An','Attraction',[['di tích','cổ','di sản','heritage']]),
 ('Tham quan chùa ở Huế','Huế','Attraction',[['chùa','pagoda','phật']]),
 ('Nhà hàng hải sản','Đà Nẵng','Restaurant',[['hải sản','seafood']]),
 ('Quán ăn chay','Đà Nẵng','Restaurant',[['chay','vegetarian','vegan']]),
 ('Quán cà phê','Đà Nẵng','Restaurant',[['cà phê','cafe','coffee']]),
 ('Quán mì Quảng đặc sản địa phương','Đà Nẵng','Restaurant',[['mì quảng','mỳ quảng']]),
 ('Nhà hàng món Hàn Quốc','Đà Nẵng','Restaurant',[['hàn quốc','korean']]),
 ('Ăn pizza hoặc món Ý','Đà Nẵng','Restaurant',[['pizza','món ý','italian']]),
 ('Nhà hàng món Việt tại Hội An','Hội An','Restaurant',[['việt nam','vietnamese']]),
 ('Khách sạn có hồ bơi','Đà Nẵng','Hotel',[['bể bơi','hồ bơi','pool']]),
 ('Khách sạn có spa thư giãn','Đà Nẵng','Hotel',[['spa']]),
 ('Khách sạn có bể bơi và spa','Đà Nẵng','Hotel',[['bể bơi','hồ bơi','pool'],['spa']]),
 ('Khách sạn có bữa sáng miễn phí','Đà Nẵng','Hotel',[['bữa sáng miễn phí','free breakfast']]),
 ('Khách sạn có phòng tập thể dục','Đà Nẵng','Hotel',[['thể dục','gym','fitness']]),
 ('Homestay tại Đà Nẵng','Đà Nẵng','Hotel',[['homestay']]),
 ('Khách sạn có hồ bơi ở Hội An','Hội An','Hotel',[['bể bơi','hồ bơi','pool']]),
 ('Khách sạn có spa ở Hội An','Hội An','Hotel',[['spa']]),
]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot');parser.add_argument('--output',required=True)
    args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    raw=Path(args.snapshot).read_bytes()
    corpus=[p for p in json.loads(raw) if p.get('active') and not p['name'].startswith('INDEXING SMOKE TEST')]
    corpus.sort(key=lambda p:p['place_id'])
    queries=[];labels=[];snapshots={}
    def add_query(text, city, kind, groups=None, target=None, category='semantic'):
        qid=f'Q{len(queries)+1:03}'
        scope=[p for p in corpus if p['city']==city and p['place_type']==kind]
        rows=[]
        for p in scope:
            structured=' '.join([p['name'],*p.get('categories',[]),*p.get('tags',[]),*p.get('amenities',[])])
            description=p.get('description') or ''
            if target is not None:
                grade=3 if fold(p['name'])==fold(target) else 0
                rationale='Normalized exact entity name' if grade else 'Different entity name'
            else:
                hits=[any(fold(term) in fold(structured+' '+description) for term in group) for group in groups]
                strong=all(any(fold(term) in fold(structured) for term in group) for group in groups)
                grade=3 if all(hits) and strong else 2 if all(hits) else 1 if any(hits) else 0
                rationale='All criteria in structured facts' if grade==3 else 'All criteria supported in description' if grade==2 else 'Partial criteria only' if grade==1 else 'No explicit supporting evidence (review required)'
            rows.append({'query_id':qid,'place_id':p['place_id'],'grade':grade,'review_status':'draft',
                         'rationale':rationale,'place_name':p['name']})
            snapshots[p['place_id']]={k:p.get(k) for k in ['place_id','name','city','place_type','description','categories','tags','amenities']}
        if not any(r['grade']>=2 for r in rows):return
        queries.append({'query_id':qid,'query':text,'filters':{'city':city,'place_type':kind},
                        'infer_filters':False,'split':'validation' if len(queries)%4==0 else 'test',
                        'category':category,'label_source':'catalog-rule-silver','judgment_scope':'all places matching explicit city/type filters',
                        'criteria':groups if groups is not None else {'exact_entity':target}})
        labels.extend(rows)
    for text,city,kind,groups in TOPICS:add_query(text,city,kind,groups)
    # Entity lookup labels are also drafts: preserve duplicate-name IDs instead of assuming one answer.
    for kind in ['Attraction','Hotel','Restaurant']:
        candidates=[p for p in corpus if p['city']=='Đà Nẵng' and p['place_type']==kind]
        chosen=[]
        for p in candidates:
            if 8<=len(p['name'])<=60 and fold(p['name']) not in {fold(x['name']) for x in chosen}:
                chosen.append(p)
            if len(chosen)==2:break
        for p in chosen:
            add_query(p['name'],p['city'],kind,target=p['name'],category='entity')
            add_query(fold(p['name']),p['city'],kind,target=p['name'],category='unaccented_entity')
    (out/'queries.jsonl').write_text('\n'.join(json.dumps(q,ensure_ascii=False) for q in queries)+'\n',encoding='utf-8')
    with (out/'queries.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['query_id','query','city','place_type','category','split','criteria']);writer.writeheader()
        writer.writerows({'query_id':q['query_id'],'query':q['query'],**q['filters'],
                          'category':q['category'],'split':q['split'],'criteria':json.dumps(q['criteria'],ensure_ascii=False)} for q in queries)
    with (out/'judgments.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['query_id','place_id','grade','review_status','place_name','rationale']);writer.writeheader();writer.writerows(labels)
    (out/'corpus.jsonl').write_text('\n'.join(json.dumps(p,ensure_ascii=False) for p in snapshots.values())+'\n',encoding='utf-8')
    manifest={'version':'place-search-v1','created_at':datetime.now(timezone.utc).isoformat(),
              'snapshot_sha256':hashlib.sha256(raw).hexdigest(),'corpus_count':len(corpus),'query_count':len(queries),
              'judgment_count':len(labels),'label_status':'draft_silver_NOT_human_gold',
              'grades':{'0':'No evidence / not relevant','1':'Partially relevant','2':'Relevant','3':'Highly relevant'},
              'binary_relevance_threshold':2,'warning':'Rule-based provisional labels, independent of retrieved rankings; human review required before thesis conclusions.'}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'queries':len(queries),'judgments':len(labels),'output':str(out)},ensure_ascii=False))


if __name__=='__main__':main()
