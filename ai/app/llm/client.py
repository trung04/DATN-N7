import json
import re
import logging
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request,urlopen
from fastapi import HTTPException
from app.core.config import env
from .response_parser import parse_structured_response
from .prompts import REQUIREMENTS_SYSTEM

logger=logging.getLogger(__name__)
TRANSIENT_STATUSES={429,500,502,503,504}


def failure_message(status):
    if status in (401,403):return 'Gemini từ chối xác thực hoặc quyền truy cập. Kiểm tra GEMINI_API_KEY và quyền của project.'
    if status==404:return 'GEMINI_MODEL không tồn tại hoặc không khả dụng cho project hiện tại. Kiểm tra lại model.'
    if status==429:return 'Gemini đang giới hạn lượt gọi hoặc đã hết quota. Kiểm tra quota/billing trong Google AI Studio, rồi thử lại sau.'
    if status in (500,502,503,504):return 'Gemini đang quá tải hoặc tạm thời không khả dụng. Đã tự thử lại; bạn có thể gửi lại sau ít phút.'
    if status==400:return 'Gemini từ chối cấu trúc yêu cầu. Kiểm tra tính tương thích của model và structured output.'
    return 'Không kết nối được Gemini trong thời gian cho phép. Bạn có thể gửi lại hoặc tắt Gemini AI để dùng chế độ theo luật.'


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
        deadline=time.monotonic()+30
        status=None
        invalid_output=False
        for attempt in range(3):
            remaining=deadline-time.monotonic()
            if remaining<=0:break
            try:
                with urlopen(request,timeout=remaining) as response:
                    raw=response.read(1_000_001)
                if len(raw)>1_000_000:
                    raise HTTPException(503,'Phản hồi Gemini vượt giới hạn xử lý. Hãy rút gọn yêu cầu và gửi lại.')
                return parse_structured_response(json.loads(raw),schema)
            except HTTPError as exc:
                status=exc.code;invalid_output=False
                exc.close()
                if status not in TRANSIENT_STATUSES:
                    raise HTTPException(503,failure_message(status)) from None
                logger.warning('Gemini temporary HTTP failure: status=%s attempt=%s',status,attempt+1)
            except (URLError,TimeoutError,OSError) as exc:
                status=None;invalid_output=False
                logger.warning('Gemini connection failure: attempt=%s',attempt+1)
            except (ValueError,UnicodeError) as exc:
                status=None;invalid_output=True
                logger.warning('Gemini structured output invalid: attempt=%s',attempt+1)
            if attempt<2:
                delay=min(.5*2**attempt,max(0,deadline-time.monotonic()))
                if delay<=0:break
                time.sleep(delay)
        message=('Gemini chưa trả dữ liệu đúng định dạng sau khi thử lại. Hãy diễn đạt ngắn gọn hơn và gửi lại.'
                 if invalid_output else failure_message(status))
        raise HTTPException(503,message) from None

    def extract(self,message,context,schema):
        result=self.generate(REQUIREMENTS_SYSTEM,json.dumps({"message":message,"context":context},ensure_ascii=False),schema)
        return result.model_dump(mode="json",exclude_none=True)
