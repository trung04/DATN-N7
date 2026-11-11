"""Versioned factual representation; reviews do not establish facilities."""
import re
import unicodedata
DOCUMENT_VERSION = "facts-v2"
def validate_encoding(value):
    if '\ufffd' in value or any(unicodedata.category(c)=='Cs' for c in value) or re.search(r'Ã[\u0080-\u00bf]|á[º»]|â€|ï¿½|ðŸ',value):
        raise ValueError("Văn bản có ký tự mất hoặc lỗi mã hóa; cần kiểm tra nguồn trước khi embedding")
    return value

def clean_text(value):
    text=unicodedata.normalize('NFC',str(value))
    text=re.sub(r'[\u200b\u200e\u200f\ufeff\u202a-\u202e\u2066-\u2069]','',text)
    text=re.sub(r'</?[A-Za-z][^>]*>',' ',text)
    return re.sub(r'\s+',' ',text).strip()
def place_document(place,max_length=8000):
    labels={'name':'Tên','place_type':'Loại','city':'Thành phố','categories':'Danh mục',
            'amenities':'Tiện ích','tags':'Sở thích','travel_styles':'Phong cách','description':'Mô tả'}
    parts=[]
    for key,label in labels.items():
        value=place.get(key)
        if value:
            text=clean_text('; '.join(value) if isinstance(value,list) else value)
            if text:parts.append(f'{label}: {text}')
    return '\n'.join(parts)[:max_length]
