"""Train an item-KNN artifact from a frozen SQLite interaction snapshot."""
import argparse
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.modules.recommendation.training import fit_item_knn

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--train-db',type=Path,required=True)
    parser.add_argument('--cutoff',required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--top-k',type=int,default=50)
    args=parser.parse_args()
    if not args.train_db.is_file():parser.error('Training snapshot does not exist')
    if args.output.resolve()==args.train_db.resolve():parser.error('Output must differ from input database')
    db=sqlite3.connect(args.train_db.resolve().as_uri()+'?mode=ro',uri=True)
    try:events=[json.loads(row[0]) for row in db.execute('SELECT data FROM events')]
    finally:db.close()
    artifact=fit_item_knn(events,datetime.fromisoformat(args.cutoff),args.top_k)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(artifact,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'users':artifact['users'],'events':artifact['events'],'items':len(artifact['neighbors'])}))

if __name__=='__main__':main()
