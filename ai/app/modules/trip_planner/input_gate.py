"""Collect and confirm chat constraints before any search/routing work."""
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from app.modules.semantic_search.text_utils import folded


def check_inputs(message, draft, conversation):
    text=folded(message).strip(' .!')
    if text in ('dung mac dinh', 'su dung mac dinh'):
        for key,value in {'party_size':1,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'},
                          'stops_per_day':3,'max_daily_activity_minutes':480}.items():
            draft.setdefault(key,value)
    labels={'city':'thành phố đến','start_date':'ngày khởi hành (dd/mm/yyyy)', 'days':'số ngày (1–14)',
            'preferences':'sở thích/trải nghiệm muốn ưu tiên', 'party_size':'số người',
            'transport':'phương tiện (ô tô, đi bộ hoặc xe đạp)', 'daily_window':'khung giờ đi chơi mỗi ngày (ví dụ: từ 9 đến 18 giờ)'}
    missing=[key for key in labels if not draft.get(key)]
    if missing:
        conversation.pop('input_confirmation',None)
        return 'Bạn bổ sung: '+ '; '.join(labels[key] for key in missing)+'. Có thể nhắn “dùng mặc định” cho số người, phương tiện và khung giờ; điểm đến, ngày đi, số ngày và sở thích vẫn cần bạn cung cấp.'
    if str(draft['start_date']) < datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date().isoformat():
        conversation.pop('input_confirmation',None)
        return 'Ngày khởi hành đã qua. Bạn chọn ngày hôm nay hoặc một ngày trong tương lai nhé.'
    # Defaults are disclosed before approval, never silently treated as user input.
    draft.setdefault('stops_per_day',3)
    draft.setdefault('max_daily_activity_minutes',480)
    draft.setdefault('breaks',[{'start':'12:00','end':'13:00'}])
    from .schemas import TripRequest
    TripRequest.model_validate({**draft,'user_id':'input-validation'})
    fingerprint=json.dumps(draft,sort_keys=True,ensure_ascii=False,default=str)
    if text in ('xac nhan','dong y tao lich') and conversation.get('input_confirmation')==fingerprint:
        conversation.pop('input_confirmation',None)
        return None
    conversation['input_confirmation']=fingerprint
    mode={'driving':'ô tô','walking':'đi bộ','cycling':'xe đạp'}[draft['transport']]
    window=draft['daily_window']
    return (f"Xác nhận yêu cầu: {draft['city']}, {draft['days']} ngày từ {draft['start_date']}; "
            f"{draft['party_size']} người; {mode}; sở thích: {', '.join(draft['preferences'])}. "
            f"Mỗi ngày {window['start']}–{window['end']}, mục tiêu {draft['stops_per_day']} điểm, "
            f"tối đa {draft['max_daily_activity_minutes']} phút hoạt động và di chuyển; "
            'nghỉ theo khung giờ đã khai báo (mặc định 12:00–13:00). '
            + ('Chưa có điểm xuất phát/nơi lưu trú: chỉ tính đường giữa các điểm tham quan. ' if not draft.get('start_location') else '')
            + 'Chưa bảo đảm ngân sách vì dữ liệu giá chưa đầy đủ. '
            'Bạn nhắn “xác nhận” để tạo lịch, hoặc sửa các thông tin trên.')
