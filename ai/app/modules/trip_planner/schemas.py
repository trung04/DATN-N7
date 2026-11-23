from datetime import date, timedelta
from typing import Annotated, Literal
from pydantic import Field, model_validator
from app.modules.recommendation.schemas import Contract, Identifier, Text


def minutes(value):
    h, m = map(int, value.split(":"))
    return 60*h+m


class TimeWindow(Contract):
    start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def ordered(self):
        if minutes(self.start) >= minutes(self.end):
            raise ValueError("Khung giờ phải kết thúc sau bắt đầu, không qua đêm")
        return self


class Coordinate(Contract):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


OpeningDay = Annotated[list[TimeWindow], Field(max_length=8)]


class TripRequest(Contract):
    user_id: Identifier
    city: Text
    start_date: date
    days: int = Field(ge=1, le=14)
    party_size: int = Field(1, ge=1, le=100)
    preferences: list[Text] | None = Field(None, max_length=30)
    query: str | None = Field(None, min_length=1, max_length=2000)
    stops_per_day: int = Field(3, ge=1, le=30)
    day_stop_limits: dict[int,int] = Field(default_factory=dict,max_length=14)
    include_types: list[Literal["Attraction", "Restaurant"]] = Field(default_factory=lambda: ["Attraction", "Restaurant"], min_length=1, max_length=2)
    daily_window: TimeWindow = Field(default_factory=lambda: TimeWindow(start="09:00", end="18:00"))
    day_windows: dict[int, TimeWindow] = Field(default_factory=dict, max_length=14)
    breaks: list[TimeWindow] = Field(default_factory=lambda: [TimeWindow(start="12:00", end="13:00")], max_length=5)
    start_location: Coordinate | None = None
    end_location: Coordinate | None = None
    return_to_start: bool = False
    transport: Literal["driving", "walking", "cycling"] = "driving"
    allow_estimated_routes: bool = True
    routing_provider: Literal['configured','ors'] = 'configured'
    max_daily_activity_minutes: int = Field(480,ge=30,le=480)
    candidate_limit: int = Field(40,ge=10,le=80)
    distance_weight: float = Field(.3,ge=0,le=1)
    duration_weight: float = Field(.7,ge=0,le=1)
    optimizer: Literal['nearest_neighbor','greedy_insertion','greedy_2opt'] = 'greedy_2opt'
    selected_place_ids: list[Identifier] = Field(default_factory=list,max_length=80)
    max_daily_distance_km: float | None = Field(None, gt=0, le=1000)
    max_leg_minutes: int | None = Field(None, gt=0, le=600)
    required_place_ids: list[Identifier] = Field(default_factory=list, max_length=80)
    excluded_place_ids: list[Identifier] = Field(default_factory=list, max_length=500)
    duration_overrides: dict[Identifier, int] = Field(default_factory=dict, max_length=80)
    opening_overrides: dict[Identifier, dict[Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"], OpeningDay]] = Field(default_factory=dict, max_length=80)
    visit_windows: dict[Identifier, TimeWindow] = Field(default_factory=dict, max_length=80)

    @model_validator(mode="after")
    def constraints(self):
        try:
            self.start_date+timedelta(days=self.days-1)
        except OverflowError as exc:
            raise ValueError("Ngày kết thúc vượt phạm vi lịch hợp lệ") from exc
        if len(set(self.include_types)) != len(self.include_types):
            raise ValueError("include_types không được trùng")
        if self.return_to_start and self.start_location is None:
            raise ValueError("return_to_start cần start_location")
        if self.return_to_start and self.end_location is not None:raise ValueError('Choose end_location or return_to_start, not both')
        if self.distance_weight+self.duration_weight<=0:raise ValueError('Route objective weights cannot both be zero')
        rests=sorted((minutes(b.start),minutes(b.end)) for b in self.breaks)
        if any(rests[i][1]>rests[i+1][0] for i in range(len(rests)-1)):raise ValueError('Break intervals must not overlap')
        if len(set(self.selected_place_ids))!=len(self.selected_place_ids):raise ValueError('selected_place_ids cannot repeat')
        if set(self.selected_place_ids)&set(self.excluded_place_ids):raise ValueError('Selected places cannot also be excluded')
        if any(day < 1 or day > self.days for day in self.day_windows):
            raise ValueError("day_windows phải nằm trong số ngày chuyến đi")
        if any(day<1 or day>self.days or count<1 or count>30 for day,count in self.day_stop_limits.items()):raise ValueError('day_stop_limits must contain valid days and 1–30 stops')
        if any(v < 10 or v > 720 for v in self.duration_overrides.values()):
            raise ValueError("Thời lượng override phải trong [10,720] phút")
        if len(set(self.required_place_ids)) != len(self.required_place_ids):
            raise ValueError("required_place_ids không được trùng")
        if set(self.required_place_ids) & set(self.excluded_place_ids):
            raise ValueError("Không thể vừa yêu cầu vừa loại cùng một địa điểm")
        return self


class DayEdit(Contract):
    user_id: Identifier
    expected_version: int = Field(ge=1)
    target_stops: int | None = Field(None,ge=1,le=30)
    remove_place_ids: list[Identifier] = Field(default_factory=list, max_length=30)
    add_place_ids: list[Identifier] = Field(default_factory=list, max_length=30)
    replacement_query: str | None = Field(None, min_length=1, max_length=2000)
    window: TimeWindow | None = None
    ordered_place_ids: list[Identifier] | None = Field(None,max_length=30)

    @model_validator(mode="after")
    def distinct(self):
        if set(self.remove_place_ids) & set(self.add_place_ids):
            raise ValueError("Không thể vừa bỏ vừa thêm cùng một địa điểm")
        if self.ordered_place_ids is not None and (self.remove_place_ids or self.add_place_ids or self.replacement_query):raise ValueError('Reorder must be separate from add/remove')
        return self


class ExtractRequest(Contract):
    message: str = Field(min_length=1, max_length=4000)
    context: dict = Field(default_factory=dict)
    use_llm: bool = False


class ChatRequest(Contract):
    user_id: Identifier
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: Identifier | None = None
    trip_id: Identifier | None = None
    expected_version: int | None = Field(None, ge=1)
    context: dict = Field(default_factory=dict)
    use_llm: bool = False
    preview_only: bool = False
    draft_id: Identifier | None = None


class RouteMatrixRequest(Contract):
    locations: list[Coordinate] = Field(min_length=1, max_length=81)
    transport: Literal["driving", "walking", "cycling"] = "driving"
    allow_estimates: bool = True


class Activity(Contract):
    place_id: str
    name: str
    place_type: str
    latitude: float
    longitude: float
    start_time: str
    end_time: str
    duration_minutes: int
    departure_time: str
    arrival_time: str
    travel_time_from_previous: int
    distance_from_previous_km: float
    waiting_minutes: int
    recommendation_score: float
    opening_hours_checked: bool
    opening_hours_source: str
    notes: list[str]
    order: int | None = None
    travel_from_previous_seconds: float | None = None
    distance_from_previous_meters: float | None = None


class RoutingSummary(Contract):
    source: str
    estimated: bool
    transport: str


class ReturnLeg(Contract):
    departure_time: str
    arrival_time: str
    duration_minutes: int
    distance_km: float


class TripDay(Contract):
    day: int
    date: str
    window: TimeWindow
    activities: list[Activity]
    return_leg: ReturnLeg | None
    total_distance_km: float
    total_travel_minutes: int
    end_time: str
    validation: dict[str, bool]
    routing: RoutingSummary | None = None
    total_visit_minutes: int = 0
    total_activity_minutes: int = 0
    total_distance_meters: float = 0
    total_travel_seconds: float = 0
    total_break_minutes: int = 0


class TripResponse(Contract):
    trip_id: str
    version: int
    user_id: str
    city: str
    start_date: str
    timezone: str
    party_size: int
    days: list[TripDay]
    routing: RoutingSummary
    optimizer: str
    status: str
    unscheduled_required_place_ids: list[str]
    warnings: list[str]
    budget_optimized: bool
    summary: str
    last_edit: dict | None = None
