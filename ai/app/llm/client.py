import json
import re
from urllib.request import Request,urlopen
from fastapi import HTTPException
from app.core.config import env
from .response_parser import parse_structured_response
from .prompts import REQUIREMENTS_SYSTEM


class GeminiClient:
    def generate(self,system,message,schema):
        key,model=env("GEMINI_API_KEY"),env("GEMINI_MODEL")
        if not key or not model or not re.fullmatch(r"[A-Za-z0-9._-]+",model):
            raise HTTPException(503,"use_llm=true cần GEMINI_API_KEY và GEMINI_MODEL hợp lệ")
        payload={"systemInstruction":{"parts":[{"text":system}]},
            "contents":[{"role":"user","parts":[{"text":message}]}],
            "generationConfig":{"temperature":0,"responseMimeType":"application/json","responseJsonSchema":schema.model_json_schema()}}
        request=Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            data=json.dumps(payload).encode(),headers={"Content-Type":"application/json","x-goog-api-key":key})
        try:
            with urlopen(request,timeout=30) as response:
                raw=response.read(1_000_001)
            if len(raw)>1_000_000:
                raise ValueError("Oversized LLM response")
            return parse_structured_response(json.loads(raw),schema)
        except Exception as exc:
            raise HTTPException(503,"Gemini không trả nội dung hợp lệ; thử lại hoặc dùng use_llm=false") from exc

    def extract(self,message,context,schema):
        result=self.generate(REQUIREMENTS_SYSTEM,json.dumps({"message":message,"context":context},ensure_ascii=False),schema)
        return result.model_dump(mode="json",exclude_none=True)
