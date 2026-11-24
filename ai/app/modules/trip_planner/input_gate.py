"""Ask only missing constraints; automatically plan once valid."""
from datetime import datetime
from zoneinfo import ZoneInfo
from app.modules.semantic_search.text_utils import folded


def check_inputs(message,draft,conversation):
    conversation.pop('input_confirmation',None)
    if 'dung mac dinh' in folded(message):
        for key,value in {'party_size':1,'transport':'driving','daily_window':{'start':'09:00','end':'18:00'}}.items():
            draft.setdefault(key,value)
    labels={'city':'điểm đến','start_date':'ngày khởi hành','days':'số ngày đi',
            'preferences':'trải nghiệm bạn thích','party_size':'số người',
            'transport':'phương tiện di chuyển','daily_window':'khung giờ đi chơi mỗi ngày'}
    missing=[k for k in labels if not draft.get(k)]
    conversation['pending_fields']=missing
    if 'may bay' in folded(message) and not draft.get('transport'):
        return 'Còn tại điểm đến, bạn muốn di chuyển bằng ô tô, đi bộ hay xe đạp?'
    if missing:return 'Bạn cho mình biết thêm '+ ' và '.join(labels[k] for k in missing[:2])+' nhé?'
    if str(draft['start_date'])<datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date().isoformat():
        conversation['pending_fields']=['start_date']
        return 'Ngày đi này đã qua rồi. Bạn muốn khởi hành ngày nào sắp tới?'
    draft.setdefault('fill_day','stops_per_day' not in draft)
    draft.setdefault('max_daily_activity_minutes',480)
    draft.setdefault('breaks',[{'start':'12:00','end':'13:00'}])
    from .schemas import TripRequest
    TripRequest.model_validate({**draft,'user_id':'validation'})
    return None
