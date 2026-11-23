"""Disposable HTTP fixture for full-chain integration; never imported by production."""
import tempfile
import uvicorn
from qdrant_client import QdrantClient
from app.main import create_app
from tests.test_recommendation import FakeEmbedding

if __name__=='__main__':
    with tempfile.TemporaryDirectory() as directory:
        app=create_app(embedding=FakeEmbedding(),qdrant=QdrantClient(':memory:'),db_path=directory+'/fixture.sqlite')
        uvicorn.run(app,host='0.0.0.0',port=9000,log_level='warning')
