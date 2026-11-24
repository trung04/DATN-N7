import secrets
from fastapi import Header, HTTPException
from .config import env

def authorize(x_api_key: str | None = Header(None)):
    expected = env("RECOMMENDATION_API_KEY")
    if expected and (not x_api_key or not secrets.compare_digest(expected, x_api_key)):
        raise HTTPException(status_code=401, detail="API key không hợp lệ")
