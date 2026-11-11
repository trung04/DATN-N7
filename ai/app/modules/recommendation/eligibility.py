"""Conservative visit/service separation using explicit category labels, never names."""
import unicodedata
ELIGIBILITY_VERSION='visit-policy-v1'

SERVICE_ONLY_CATEGORIES=frozenset(unicodedata.normalize('NFC',s).casefold() for s in (
    'Đại lý du lịch','Nhà điều hành du lịch','Đại lý vé máy bay','Trung tâm thông tin du lịch',
    'Dịch vụ vận tải','Dịch vụ ô tô riêng','Văn phòng công ty','Dịch vụ tư vấn thị thực',
    'Nhà tư vấn','Tư vấn viên quản trị doanh nghiệp','Travel agency','Tour operator',
    'Tourist information center','Airline ticket agency','Corporate office','Transportation service'))

def service_only(place):
    categories={unicodedata.normalize('NFC',x).strip().casefold() for x in place.get('categories',[]) if x.strip()}
    return place.get('place_type')=='Attraction' and bool(categories) and categories<=SERVICE_ONLY_CATEGORIES

def eligible_for_request(place,request):
    # Explicit category requests may intentionally seek a tour operator or travel service.
    return bool(request.include_service_places or request.category or not service_only(place))

def display_identity(place):
    """Presentation diversity only; does not merge records or assert entity identity."""
    normalize=lambda value:' '.join(unicodedata.normalize('NFC',value).casefold().split())
    return normalize(place['name']),normalize(place['city']),place['place_type']
