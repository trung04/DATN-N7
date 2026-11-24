"""Parse explicit same-day clock ranges independently of LLM extraction."""
import re
import unicodedata


def parse_daily_window(message):
    text=''.join(c for c in unicodedata.normalize('NFD',message.casefold().replace('đ','d')) if unicodedata.category(c)!='Mn')
    clock=r'(\d{1,2})(?:\s*(h|:|gio)\s*(\d{1,2})?)?\s*(sang|chieu|toi|trua)?'
    match=re.search(r'(?<![\d/:-])'+clock+r'\s*(?:den|toi|[-–—])\s*'+clock+r'(?!\d)',text)
    if not match:return None
    sh,su,sm,sp,eh,eu,em,ep=match.groups()
    if not (su or eu or sp or ep):return None  # Not a day range or calendar date.
    def clock_value(hour,minute,period):
        hour=int(hour);minute=int(minute or 0)
        if period in ('chieu','toi','trua') and hour<12:hour+=12
        if period=='sang' and hour==12:hour=0
        return f'{hour:02d}:{minute:02d}'
    return {'start':clock_value(sh,sm,sp),'end':clock_value(eh,em,ep)}
