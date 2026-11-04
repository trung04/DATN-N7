import re
from app.modules.semantic_search.text_utils import folded

class IntentRouter:
    def classify(self,message,has_trip=False):
        text=folded(message)
        if any(term in text for term in ("lap lich","lich trinh","ke hoach du lich","len ke hoach")):
            return "trip_planning"
        if re.search(r"\bngay\s+(?:thu\s+)?(?:\d+|hai|ba|tu|nam|sau|bay)\b",text) and any(w in text.split() for w in ("bo","thay","doi")):
            return "replanning"
        if has_trip and any(w in text.split() for w in ("bo","thay","doi")):
            return "replanning"
        if any(term in text for term in ("tim ","goi y","khach san","nha hang","quan ca phe","toi thich")):
            return "place_search"
        if any(term in text for term in ("mo cua","dia chi","danh gia","du lich","tham quan")):
            return "travel_qa"
        return "general_chat"
