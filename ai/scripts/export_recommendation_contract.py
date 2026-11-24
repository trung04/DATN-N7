"""Export Recommendation APIs and reachable schemas; exclude demo and unrelated modules."""
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.main import create_app


def export():
    full=create_app().openapi()
    paths={path:full['paths'][path] for path in (
        '/api/v1/recommendations','/api/v1/recommendations/{request_id}',
        '/api/v1/users/{user_id}/preferences','/api/v1/users/{user_id}/interactions',
        '/api/v1/recommendation/status','/api/v1/recommendation/reindex')}
    schemas={}

    def collect(node):
        if isinstance(node,dict):
            ref=node.get('$ref','')
            if ref.startswith('#/components/schemas/'):
                name=ref.rsplit('/',1)[1]
                if name not in schemas:
                    schemas[name]=full['components']['schemas'][name]
                    collect(schemas[name])
            for value in node.values():collect(value)
        elif isinstance(node,list):
            for value in node:collect(value)

    collect(paths)
    spec={'openapi':full['openapi'],
          'info':{'title':'Automatic Recommendation API','version':'1.0.0'},
          'paths':paths,'components':{'schemas':schemas}}
    target=Path(__file__).resolve().parents[1]/'contracts'/'recommendation.openapi.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':export()
