"""Export only text-search APIs and their reachable schemas; no demo or other modules."""
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.main import create_app


def export():
    full=create_app().openapi()
    paths={path:full['paths'][path] for path in (
        '/api/v1/search/places','/api/v1/embeddings/text','/api/v1/embeddings/batch')}
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
          'info':{'title':'Text place search API','version':'1.0.0'},
          'paths':paths,'components':{'schemas':schemas}}
    target=Path(__file__).resolve().parents[1]/'contracts'/'text-search.openapi.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':export()
