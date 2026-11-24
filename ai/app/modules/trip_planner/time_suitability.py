"""Date/coordinate-aware suitability, distinct from verified opening hours."""
import math
import re
from app.modules.semantic_search.text_utils import folded


def sunset_minute(day,latitude,longitude):
    # NOAA fractional-year approximation, zenith 90.833 degrees; local UTC+7.
    # https://gml.noaa.gov/grad/solcalc/solareqns.PDF
    gamma=2*math.pi/365*(day.timetuple().tm_yday-1)
    eq=229.18*(.000075+.001868*math.cos(gamma)-.032077*math.sin(gamma)-.014615*math.cos(2*gamma)-.040849*math.sin(2*gamma))
    dec=.006918-.399912*math.cos(gamma)+.070257*math.sin(gamma)-.006758*math.cos(2*gamma)+.000907*math.sin(2*gamma)-.002697*math.cos(3*gamma)+.00148*math.sin(3*gamma)
    lat=math.radians(latitude)
    cos_h=(math.cos(math.radians(90.833))-math.sin(lat)*math.sin(dec))/(math.cos(lat)*math.cos(dec))
    if not -1<=cos_h<=1:return None
    return round((720-4*(longitude-math.degrees(math.acos(cos_h)))-eq+420)%1440)


def night_market(place):
    text=folded(' '.join([place.get('name',''),*place.get('categories',[]),*place.get('tags',[])]))
    return bool(re.search(r'\b(cho dem|night market)\b',text))


def mark_sunset_candidates(req,candidates,matrix=None):
    intent=folded(' '.join([req.query or '',*(req.preferences or [])]))
    if 'hoang hon' not in intent and 'sunset' not in intent:return candidates
    eligible=[]
    for c in candidates:
        c.pop('sunset_visit',None);c.pop('time_priority',None)
        p=c['place'];text=folded(' '.join([p.get('name',''),p.get('description') or '',*p.get('tags',[])]))
        if p['place_type']!='Attraction' or night_market(p) or p['place_id'] in req.visit_windows or p.get('latitude') is None or p.get('longitude') is None:continue
        explicit='hoang hon' in text or 'sunset' in text
        coastal=bool(re.search(r'\b(bien|beach|ban dao|coast)\b',text))
        degree=0
        if matrix is not None:
            index=candidates.index(c)
            degree=sum(matrix['minutes'][index][j] is not None and matrix['minutes'][j][index] is not None for j in range(len(candidates)) if j!=index)
            if not degree and len(candidates)>1:continue
        if explicit or coastal:eligible.append((-degree,not explicit,-c['score'],p['place_id'],c))
    for *_,c in sorted(eligible,key=lambda x:x[:4])[:req.days]:
        c['sunset_visit']=True;c['time_priority']=True
    return candidates


def suitable_intervals(place,intervals,day):
    if night_market(place):
        # Semantic policy, not an assertion that the venue is open.
        return [(max(left,18*60),min(right,24*60)) for left,right in intervals if max(left,18*60)<min(right,24*60)]
    return intervals
