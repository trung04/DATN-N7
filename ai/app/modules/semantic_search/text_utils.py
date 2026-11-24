import re
import unicodedata

def folded(text):
    text = unicodedata.normalize("NFD", text.casefold().replace("đ", "d"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", text))

FEATURES = {
    "Bể bơi": ("be boi", "ho boi", "swimming pool"),
    "Spa": ("spa",),
    "Wi-Fi": ("wi fi", "wifi"),
    "Đỗ xe": ("do xe", "dau xe", "parking"),
    "Bữa sáng": ("bua sang", "breakfast"),
}

TYPES = {"Hotel": ("khach san", "resort", "hotel", "homestay"),
         "Restaurant": ("nha hang", "restaurant", "quan an"),
         "Attraction": ("diem tham quan", "dia diem tham quan", "attraction", "bao tang", "bai bien")}

STOPWORDS = set("tim toi muon mot nhung cac dia diem o tai va co cho la voi giup gan cua".split())

def contains(text, phrase):
    return bool(re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text))

def negative_before(text, start):
    return bool(re.search(r"(?:khong|tranh|ngoai tru)(?:\s+\w+){0,2}\s*$", text[max(0,start-30):start]))

def feature_key(value):
    value = folded(value)
    for canonical, aliases in FEATURES.items():
        if value == folded(canonical) or value in aliases:
            return canonical
    return value

def place_features(place):
    present = set()
    for item in place["amenities"]:
        text = folded(item)
        present.add(text)
        for key, aliases in FEATURES.items():
            if any((m := re.search(r"\b" + re.escape(alias) + r"\b", text)) and
                   not negative_before(text, m.start()) for alias in aliases):
                present.add(key)
    return present
