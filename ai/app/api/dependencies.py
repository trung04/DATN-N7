from fastapi import Request
from app.core.auth import authorize

def service(request: Request):
    return request.app.state.recommendation
