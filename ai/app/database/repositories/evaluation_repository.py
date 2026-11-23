import json
from app.core.exceptions import NotFound, Conflict


class EvaluationRepository:
    def evaluations_for_report(self):
        with self.connection() as db:
            rows=db.execute('SELECT data FROM search_evaluations ORDER BY rowid DESC LIMIT 500').fetchall()
        return [json.loads(r[0]) for r in rows]

    def create_evaluation(self, data):
        with self.connection() as db:
            db.execute('INSERT INTO search_evaluations VALUES(?,?,?,?)',
                       (data['id'],data['created_at'],data['version'],json.dumps(data,ensure_ascii=False)))

    def evaluation(self, evaluation_id):
        with self.connection() as db:
            row=db.execute('SELECT data FROM search_evaluations WHERE id=?',(evaluation_id,)).fetchone()
        if not row:raise NotFound('Evaluation not found')
        return json.loads(row[0])

    def save_evaluation_labels(self, evaluation_id, version, labels):
        with self.connection() as db:
            row=db.execute('SELECT data FROM search_evaluations WHERE id=?',(evaluation_id,)).fetchone()
            if not row:raise NotFound('Evaluation not found')
            data=json.loads(row[0])
            if data['version']!=version:raise Conflict('Evaluation changed. Reload before saving labels.')
            scope={p['place_id'] for p in data['corpus']}
            if not set(labels).issubset(scope):raise ValueError('Label ID outside frozen evaluation scope')
            for pid,grade in labels.items():
                if grade is None:data['labels'].pop(pid,None)
                else:data['labels'][pid]=grade
            data['version']+=1
            db.execute('UPDATE search_evaluations SET version=?,data=? WHERE id=?',
                       (data['version'],json.dumps(data,ensure_ascii=False),evaluation_id))
        return data

    def evaluation_list(self):
        with self.connection() as db:
            rows=db.execute('SELECT data FROM search_evaluations ORDER BY rowid DESC LIMIT 50').fetchall()
        return [{'id':d['id'],'query':d['query'],'created_at':d['created_at'],
                 'labeled':len(d['labels']),'scope':len(d['corpus'])} for d in (json.loads(r[0]) for r in rows)]
