# AI Trip Planner

Module tạo lịch trình từ catalog thật, ghép Semantic Search + Recommendation với ma trận di chuyển, greedy insertion và 2-opt có kiểm tra ràng buộc. Có lưu lịch trình/hội thoại SQLite và sửa riêng từng ngày. Đây là baseline heuristic giải thích được; không cam kết tối ưu toàn cục, tình trạng mở cửa hoặc giao thông thời gian thực.

## API

Tất cả dùng prefix `/api/v1` và header `X-API-Key` nếu `RECOMMENDATION_API_KEY` đã cấu hình.

| Method | Path | Chức năng |
|---|---|---|
| POST | `/trips/extract` | Trích xuất yêu cầu từ câu tiếng Việt và báo trường còn thiếu |
| POST | `/trips/route-matrix` | Ma trận thời gian/phút và khoảng cách/km |
| POST | `/trips` | Tạo và lưu lịch nhiều ngày, HTTP 201 |
| GET | `/trips/{trip_id}?user_id=...` | Đọc lịch đã lưu |
| PATCH | `/trips/{trip_id}/days/{day}` | Chỉnh riêng một ngày, kiểm tra phiên bản |
| GET | `/trips/{trip_id}/validation?user_id=...` | Kiểm tra lịch đã lưu với catalog hiện tại |
| POST | `/trip-planner/chat` | Hội thoại lập/chỉnh lịch, có bước hỏi thông tin còn thiếu |

Swagger tại http://localhost:9000/docs. Các schema đầy đủ nằm trong Swagger, gồm TripRequest, TripResponse, DayEdit, ChatRequest. Không cần cài thêm thư viện cho module này.

## 1. Tạo lịch từ backend

```json
{
  "user_id": "u_123",
  "city": "Đà Nẵng",
  "start_date": "2026-11-10",
  "days": 3,
  "party_size": 2,
  "preferences": ["biển", "hải sản", "cà phê"],
  "stops_per_day": 3,
  "daily_window": {"start": "09:00", "end": "18:00"},
  "day_windows": {
    "1": {"start": "14:00", "end": "18:00"},
    "3": {"start": "09:00", "end": "16:00"}
  },
  "breaks": [{"start": "12:00", "end": "13:00"}],
  "start_location": {"latitude": 16.05, "longitude": 108.2},
  "return_to_start": true,
  "transport": "driving",
  "max_daily_distance_km": 30,
  "max_leg_minutes": 45,
  "allow_estimated_routes": true
}
```

Điều kiện bắt buộc: user_id, city, start_date, days. Từ 1–14 ngày, 1–6 điểm/ngày. Một thành phố mỗi chuyến, giờ theo Việt Nam UTC+7. Không có lịch qua đêm hoặc tự suy ngày khởi hành. `day_windows` kiểm soát ngày đến/ngày về riêng; nghỉ trưa mặc định 12:00–13:00, truyền `breaks:[]` nếu không muốn dành giờ nghỉ. Chặng đi cũng được dời để không trùng giờ nghỉ.

`start_location` là nơi lưu trú/điểm xuất phát được dùng cho mỗi ngày. `return_to_start:true` phải có tọa độ này; chặng quay về được tính vào thời gian kết thúc, giới hạn km/ngày và giới hạn phút/chặng. Nếu không gửi điểm xuất phát, mỗi ngày bắt đầu tại địa điểm đầu tiên; API ghi rõ không tính chặng đi đến điểm đó. Khi không yêu cầu quay về, chặng trở lại nơi lưu trú không được tính.

Chọn điểm từ Attraction/Restaurant; Hotel không được xếp thành hoạt động tham quan. Backend có thể cho người dùng chọn khách sạn rồi truyền tọa độ vào start_location. Party size được giữ làm thông tin chuyến đi, chưa giải bài toán sức chứa/đặt chỗ theo số người.

Các tùy chọn khác:

- `include_types`: chỉ Attraction, Restaurant hoặc cả hai; tối đa hai nhà hàng/ngày để hạn chế trùng loại.
- `required_place_ids`: ưu tiên xếp các địa điểm này; nếu không xếp vừa, status partial và liệt kê rõ ID còn thiếu. ID sai, ngừng hoạt động, khác thành phố/loại hoặc thiếu tọa độ bị từ chối 422.
- `excluded_place_ids`: loại khỏi chuyến đi.
- `duration_overrides`: map place_id → phút, 10–720 phút.
- `visit_windows`: map place_id → `{start,end}`, chỉ định giờ muốn ghé một nơi, ví dụ 16:00–18:00. Không tự suy giờ hoàng hôn hoặc hướng ngắm mặt trời.
- `opening_overrides`: map place_id → lịch tuần do backend cung cấp. Ưu tiên hơn giờ trong catalog; các ngày không khai báo được hiểu là đóng cửa, không phải chưa biết.

Không tự suy giá vé, giá phòng hay ngân sách; `budget_optimized` luôn false. Chưa có tính thời tiết, hướng hoàng hôn, lịch sự kiện, availability đặt chỗ, meal windows riêng hoặc tự đặt phòng/đặt vé. Backend nên đặt visit_windows cho bữa ăn/giờ ngắm cảnh cụ thể khi cần.

## 2. Cấu trúc kết quả

Response có trip_id, version, user_id, city, days, status, routing, warnings và unscheduled_required_place_ids.

Mỗi ngày có date, window, activities, total_distance_km, total_travel_minutes, end_time, return_leg, validation và routing riêng. Mỗi activity có:

- place_id, name, place_type và tọa độ thật từ catalog.
- start_time/end_time dạng ISO với +07:00, duration_minutes.
- departure_time/arrival_time, travel_time_from_previous/phút, distance_from_previous_km.
- waiting_minutes: chờ mở cửa và chờ qua giờ nghỉ.
- recommendation_score, opening_hours_checked/source, notes.

`planned` nghĩa xếp đủ mục tiêu số điểm/ngày và các địa điểm bắt buộc; không đồng nghĩa mọi giờ mở cửa đều đã biết. `partial` nghĩa không đủ điểm phù hợp hoặc không xếp vừa, không tự nới điều kiện. Khi chủ động bỏ một điểm mà không thay, lịch có thể thành partial so với stops_per_day ban đầu. Lịch rỗng không được mô tả là chuyến đi hoàn chỉnh.

Giờ chưa biết hoặc thời lượng mặc định được ghi ở notes. Mặc định 60 phút/Attraction, 45 phút/Restaurant khi không có dữ liệu. Giới hạn thời gian/km được kiểm tra trên ma trận đang sử dụng; nếu routing estimated thì không được xem là kiểm chứng quãng đường thực tế.

## 3. Cung cấp giờ mở cửa có cấu trúc

API embedding/place và places/batch đã nhận thêm:

```json
{
  "weekly_opening_hours": {
    "mon": [{"start":"08:00","end":"11:30"}, {"start":"13:00","end":"17:00"}],
    "tue": [{"start":"08:00","end":"17:00"}],
    "wed": [],
    "thu": [{"start":"08:00","end":"17:00"}],
    "fri": [{"start":"08:00","end":"17:00"}],
    "sat": [{"start":"08:00","end":"17:00"}],
    "sun": [{"start":"08:00","end":"17:00"}]
  }
}
```

Khi weekly_opening_hours không null, ngày không khai báo hoặc danh sách rỗng nghĩa đóng cửa. Không truyền weekly_opening_hours nếu chưa biết lịch. Khoảng giờ không qua nửa đêm. `closed_days` nhận biết các ngày đơn giản tiếng Việt/Anh. Raw opening_hours chỉ được dùng tự động cho dạng rõ ràng `08:00-17:00`, `24/7`, `24h`, `Mở cửa cả ngày`; các định dạng phức tạp/JSON scrape chưa được đoán là đã kiểm chứng. Lịch override của request được ưu tiên hơn catalog.

Giờ trong catalog vẫn cần được cập nhật từ nguồn đáng tin cậy; opening_hours_checked chỉ nói đã đối chiếu dữ liệu, không phải gọi nhà cung cấp để xác nhận mở cửa hôm đó.

## 4. Chỉnh một ngày

PATCH `/api/v1/trips/{trip_id}/days/2`:

```json
{
  "user_id":"u_123",
  "expected_version":1,
  "remove_place_ids":["place_old"],
  "replacement_query":"quán cà phê gần biển",
  "window":{"start":"09:00","end":"18:00"}
}
```

Hoặc gửi add_place_ids để thêm địa điểm cụ thể. Những điểm còn lại của ngày được giữ là bắt buộc, rồi chỉ ngày đó được tối ưu lại. Không chọn trùng điểm với ngày khác. Không tự thay các ngày khác để ép điểm mới vừa lịch. Không xếp vừa các điểm giữ lại/thêm mới trả 409 và không lưu thay đổi. Version cũ cũng trả 409; backend tải lại lịch rồi quyết định gửi bản chỉnh mới.

replacement_query yêu cầu tìm và bổ sung điểm tới số mục tiêu của ngày; nếu không có điểm phù hợp còn chỗ thì có thể partial. Không gửi replacement_query thì chỉ xếp lại các điểm giữ/thêm. Routing từng ngày được lưu riêng; nếu chỉnh ngày bằng nguồn routing khác, routing tổng hợp có thể là mixed và estimated=true nếu bất kỳ ngày nào còn ước tính.

## 5. Hội thoại nhiều lượt

POST `/api/v1/trip-planner/chat`:

```json
{
  "user_id":"u_123",
  "message":"Lập lịch Đà Nẵng 3 ngày cho 2 người, thích biển và cà phê",
  "use_llm":false
}
```

Chưa có ngày bắt đầu → status needs_clarification, trả conversation_id và hỏi ngày. Gửi tiếp:

```json
{
  "user_id":"u_123",
  "conversation_id":"ID_HOI_THOAI",
  "message":"Khởi hành 2026-11-10",
  "context":{
    "max_daily_distance_km":30,
    "start_location":{"latitude":16.05,"longitude":108.2}
  }
}
```

Khi đủ city/start_date/days, API tạo lịch và trả status created. Context nhận các trường TripRequest, không dùng để ép user_id khác. Sau đó có thể yêu cầu “Ngày 2 bỏ TÊN ĐỊA ĐIỂM đi, thay bằng quán cà phê”; cần nhận diện được duy nhất địa điểm của ngày. Mơ hồ sẽ hỏi lại, không tự xóa một điểm bất kỳ. Có thể gửi trip_id và expected_version để chỉnh lịch đã lưu; hội thoại giữ liên kết với lịch cho các lượt tiếp theo.

Fallback parser nhận city phổ biến hoặc trong catalog, số ngày/người, ngày ISO hoặc dd/mm/yyyy, một số sở thích/phương tiện, số điểm/ngày và mẫu bỏ/thay cơ bản. Không hỗ trợ mọi diễn đạt, không tự đoán “thứ sáu tuần tới”, không tự đặt giới hạn cho “không đi xa”. Gửi giới hạn số qua context/backend khi cần. Không chuyển phủ định tự do thành ràng buộc cứng; cần excluded_place_ids. Raw query yêu cầu ban đầu được giữ để retrieval không chỉ phụ thuộc danh sách sở thích nhận diện.

Hội thoại lưu bền vững trong SQLite (tối đa 40 message gần nhất); backend nên gửi tuần tự cho cùng conversation_id. Đây là hội thoại trong phạm vi Trip Planner, chưa phải chatbot kiến thức/tính toán tổng quát hay toàn bộ Travel Assistant trong bản thiết kế.

## 6. LLM tùy chọn

Đặt GEMINI_API_KEY và GEMINI_MODEL trong .env, khởi động lại container để env được nạp, rồi gửi use_llm:true. Không có model mặc định được tự chọn hoặc tự phát sinh chi phí. Adapter dùng Gemini generateContent với JSON Schema và Pydantic validation; chỉ trích yêu cầu, không sinh place_id, lộ trình hay giờ mở cửa. Địa điểm và giờ trong kết quả luôn do catalog/optimizer quyết định.

use_llm=true gửi message và context yêu cầu đến Gemini. Không cấu hình hoặc phản hồi LLM không hợp lệ trả 503; backend có thể chọn thử lại với use_llm:false. Không để LLM thực thi code/tool tùy ý; các công cụ Search/Recommendation/Routing được orchestration cố định trong Python. Chưa dùng LangGraph, chưa triển khai general-chat agent hay agent tự quyết định tool ngoài luồng này.

## 7. Routing tùy chọn

```dotenv
TRIP_OSRM_URL=
TRIP_OSRM_DRIVING_URL=
TRIP_OSRM_WALKING_URL=
TRIP_OSRM_CYCLING_URL=
GEMINI_API_KEY=
GEMINI_MODEL=
```

OSRM URL là base URL của dịch vụ admin tin cậy, không phải giá trị client tự gửi. Mỗi server phải được build đúng profile/coverage Việt Nam. Nhãn foot/bike trong URL không tự biến một server car thành routing đi bộ/xe đạp. Table API trả giây/mét; adapter đổi phút/km và giữ các cặp null là không có tuyến. Cặp không có tuyến không bị thay thành 0 hoặc đường chim bay.

Không cấu hình hoặc provider lỗi và allow_estimated_routes=true → ước tính Haversine nhân hệ số 1.3 cho driving/cycling, 1.15 cho walking; tốc độ giả định 25/12/4.5 km/h tương ứng. Đây không phải đường bộ đã kiểm chứng và có thể sai với cầu, sông, đèo hoặc cấm đường. Response source/estimated/warnings nói rõ. Khi cần routing thật bắt buộc, dùng allow_estimated_routes:false; thiếu/lỗi provider trả 503. Không gọi public demo routing server mặc định.

POST `/trips/route-matrix` nhận locations (1–81 tọa độ), transport, allow_estimates. Dùng route API riêng nếu frontend cần polyline/bản đồ đường đi thực tế; module này mới trả ma trận và tọa độ các điểm.

## 8. Kiểm tra lại và vận hành

GET validation đối chiếu catalog hiện tại: tồn tại/active, tọa độ thay đổi, giờ mở cửa đã biết, khung ngày/nghỉ, thứ tự thời gian, trùng điểm, các ID bắt buộc. valid kiểm tra các ràng buộc được kiểm chứng; complete riêng biệt cho biết đạt mục tiêu lịch hay chưa. Status invalid/incomplete/valid_with_assumptions/valid_against_catalog; không thay thế kiểm tra tình trạng hoạt động/giao thông thực tế.

Candidate pool tối đa 80 địa điểm, greedy insertion ưu tiên required rồi mức phù hợp trừ chi phí di chuyển; 2-opt chỉ nhận thay đổi vẫn thỏa toàn bộ kiểm tra lịch. Không có bảo đảm tìm được phương án nếu tồn tại phương án tối ưu khác; có thể partial vì heuristic. Không tạo địa điểm giả nếu thiếu catalog. Chưa có OR-Tools/VRP, đặt chỗ, giá hay đa thành phố.

Đặt API sau backend đã xác thực người dùng. Service API key không phải tài khoản end-user; backend phải lấy user_id từ phiên đăng nhập, tránh cho client tự chọn user_id người khác. SQLite/volume hiện có giữ trips và trip_conversations; không xóa volume khi cần giữ lịch. Dùng GET để khôi phục lịch; dữ liệu hội thoại/lịch cần chính sách lưu/xóa ở tầng backend khi đưa lên production.

Kiểm thử:

```powershell
python -m unittest discover -s tests -v
```

Tests dùng embedding giả và Qdrant in-memory. Gemini/OSRM được mock hoặc tắt, không gọi dịch vụ trả phí. Kiểm thử logic không chứng minh chất lượng gợi ý/đường đi ngoài thực tế.

Nguồn tích hợp: [OSRM Table API](https://project-osrm.org/docs/v5.24.0/api/#table-service), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
