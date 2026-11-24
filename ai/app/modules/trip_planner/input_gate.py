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
    from .schemas import minutes
    for meal,value in draft.get('meal_start_times',{}).items():
        if not minutes(draft['daily_window']['start'])<=minutes(value)<minutes(draft['daily_window']['end']):
            conversation['pending_fields']=['daily_window']
            label='ăn trưa' if meal=='lunch' else 'ăn tối'
            return f"Giờ {label} {value} nằm ngoài khung đi chơi {draft['daily_window']['start']}–{draft['daily_window']['end']}. Bạn muốn đổi giờ ăn hay mở rộng khung đi chơi?"
    draft.setdefault('visit_duration_mode','adaptive')
    if draft['visit_duration_mode']=='adaptive' and draft.get('duration_focus') is None:
        if len(draft.get('preferences') or [])>1 and 'dung mac dinh' not in folded(message) and not conversation.get('duration_focus_asked'):
            conversation['duration_focus_asked']=True
            conversation['pending_fields']=['duration_focus']
            return 'Bạn muốn dành nhiều thời gian hơn cho trải nghiệm nào, chẳng hạn '+', '.join(draft['preferences'][:3])+'? Nếu không ưu tiên riêng, mình sẽ tự phân bổ theo mức độ phù hợp với sở thích của bạn.'
        draft['duration_focus']=[]
    draft.setdefault('fill_day','stops_per_day' not in draft)
    draft.setdefault('breaks',[{'start':'12:00','end':'13:00'}])
    draft.setdefault('meal_break_is_rest',False)
    draft.setdefault('activity_budget_mode','explicit' if 'max_daily_activity_minutes' in draft else 'auto')
    if draft['activity_budget_mode']=='auto':
        start,end=minutes(draft['daily_window']['start']),minutes(draft['daily_window']['end'])
        rest=sum(max(0,min(end,minutes(b['end']))-max(start,minutes(b['start']))) for b in draft['breaks'])
        draft['max_daily_activity_minutes']=max(30,end-start-rest)
    else:draft.setdefault('max_daily_activity_minutes',480)
    from .schemas import TripRequest
    TripRequest.model_validate({**draft,'user_id':'validation'})
    return None
