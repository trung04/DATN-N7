def parse_structured_response(data,schema):
    candidates=data.get("candidates") or []
    if not candidates:
        raise ValueError("LLM không trả candidate")
    parts=candidates[0].get("content",{}).get("parts",[])
    text="".join(p.get("text","") for p in parts if not p.get("thought"))
    return schema.model_validate_json(text)
