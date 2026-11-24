# Chatbot và AI Trip Planner — bàn giao tích hợp

## Phạm vi

Backend gọi AI qua HTTP; frontend gọi backend bằng phiên đăng nhập của sản phẩm. Backend xác thực người dùng, lấy `user_id` từ phiên và gọi AI với service key. Không để frontend giữ Gemini key, ORS key hoặc service key; không tin `user_id` do trình duyệt tự nhập.

Luồng chính: `POST /api/v1/chat` → hiểu intent/thay đổi yêu cầu bằng Gemini → giữ trạng thái → hỏi thông tin thiếu → Search/Recommendation lấy ứng viên thật → ORS lấy ma trận đường bộ → greedy insertion + constrained 2-opt → trả lịch theo ngày. LLM không tự tạo địa điểm, tọa độ hay thời gian di chuyển.

Bản này chỉ bàn giao AI. Không chứa giao diện demo mới, code backend/frontend hoặc migration PostgreSQL. Search Hybrid và Recommendation đã có trên dev được giữ nguyên. Dùng `preview_only=true` cho tích hợp mới; backend quyết định lưu lịch chính thức vào database của sản phẩm.

## 1. Chạy riêng AI + Qdrant

Từ thư mục gốc repository:

```powershell
Copy-Item ai/.env.example ai/.env
# Mở ai/.env và điền các khóa bên dưới trước khi chạy.
docker compose --env-file ai/.env -f ai/compose.ai.yml up -d --build
```

Không ghi đè `.env` đã có. Compose riêng chỉ chạy AI và Qdrant, không khởi động backend/frontend. Cổng mặc định AI `9002`, Qdrant `6335`; nếu trùng cổng thì sửa `AI_PORT`/`QDRANT_PORT` trong `ai/.env`.

- Swagger: `http://localhost:9002/docs`
- Health: `GET http://localhost:9002/health`
- Readiness: `GET http://localhost:9002/ready`
- Qdrant: `http://localhost:6335/dashboard`
- Backend chạy trên máy: base URL `http://127.0.0.1:9002`.
- Backend trong Docker cần chung network với AI rồi dùng `http://ai:9000`, hoặc dùng `http://host.docker.internal:9002` trên Docker Desktop. Compose riêng không tự nối network với compose chính.

Health/ready chỉ xác nhận tiến trình và Qdrant, **không xác nhận Gemini/ORS key hoặc dữ liệu địa điểm đã sẵn sàng**. Lần đầu tải BGE-M3 cần mạng, dung lượng model cache và RAM; dữ liệu/model được giữ trong volume.

Chạy Python trực tiếp nếu đã có Qdrant:

```powershell
cd ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
# ai/.env: QDRANT_URL=http://127.0.0.1:6335 nếu dùng Qdrant từ compose riêng.
python -m uvicorn app.main:app --host 127.0.0.1 --port 9002
```

`ai/.env` được nạp khi chạy native. Compose riêng dùng `--env-file ai/.env` và `env_file: .env`. Compose chính ở root dùng **root `.env`** và khối `services.ai.environment`; chỉ thêm biến vào `ai/.env` sẽ không tự truyền vào compose chính. Muốn dùng compose chính, người tích hợp phải truyền thêm các biến ORS bên dưới vào service `ai`.

## 2. ENV và API key

| Biến | Cần cho | Giá trị/cách dùng |
|---|---|---|
| `RECOMMENDATION_API_KEY` | Mọi API nghiệp vụ | Tự tạo chuỗi bí mật dài; backend gửi qua `X-API-Key`. Đây không phải key Gemini/ORS. Compose riêng bắt buộc có giá trị. |
| `GEMINI_API_KEY` | Chat với `use_llm=true` | Key Google AI Studio của project có quota. Để trống thì không dùng chat LLM. |
| `GEMINI_MODEL` | Chat LLM | ID model được project cho phép; ví dụ trong env là `gemini-2.5-flash`, cần kiểm tra quyền/quota thực tế. |
| `TRIP_ORS_MODE` | Preview/planner đường bộ | `direct`: AI gọi ORS, không cần routing backend. |
| `ORS_API_KEY` | Tạo lịch với ORS | Key có quyền Matrix API và quota; không dùng Gemini key thay thế. |
| `ORS_BASE_URL` | ORS | `https://api.heigit.org`; cũng hỗ trợ HTTPS origin của ORS tương thích. Không thêm `/v2/matrix` vào biến này. |
| `ORS_PROFILES` | Phương tiện | Danh sách không có khoảng trắng: `driving-car,foot-walking,cycling-regular`; chỉ bật profile mà tài khoản/provider hỗ trợ. |
| `ORS_MIN_INTERVAL_MS` | Rate limit ORS | Mặc định `2100`; tùy quota của tài khoản. |
| `ORS_CACHE_TTL_SECONDS` | Cache ma trận | `21600` giây; cache có hướng theo tọa độ và profile. |
| `TRIP_ORS_CACHE_PATH` | Lưu cache | Native `data/route_matrix_cache.sqlite3`; Docker riêng tự đổi sang `/app/data/...`. |
| `QDRANT_URL` | Search/Recommendation/planner | Native là URL Qdrant đang chạy; Docker riêng tự đặt `http://qdrant:6333`. |
| `RECOMMENDATION_DB_PATH` | Catalog/session/preview | Native `data/recommendation.sqlite3`; Docker `/app/data/recommendation.sqlite3`. |
| `MODEL_NAME` | Embedding | `BAAI/bge-m3`; không cần Gemini key cho embedding local. |
| `RECOMMENDATION_COLLECTION` | Vector địa điểm | `documents_bge_m3`. |
| `RECOMMENDATION_VECTOR_NAME` | Dense vector | `dense`; vector phải đúng model/số chiều. |

Mẫu tối thiểu trong `ai/.env` (điền key thật ở máy/server riêng, không commit):

```dotenv
RECOMMENDATION_API_KEY=replace_with_random_internal_key
GEMINI_API_KEY=replace_with_your_google_key
GEMINI_MODEL=gemini-2.5-flash
TRIP_ORS_MODE=direct
ORS_API_KEY=replace_with_your_ors_key
ORS_BASE_URL=https://api.heigit.org
ORS_PROFILES=driving-car,foot-walking,cycling-regular
QDRANT_URL=http://127.0.0.1:6335
RECOMMENDATION_COLLECTION=documents_bge_m3
RECOMMENDATION_VECTOR_NAME=dense
```

Google: [tạo API key](https://aistudio.google.com/apikey), [quota và quyền API](https://ai.google.dev/gemini-api/docs/rate-limits). ORS: [dashboard](https://dashboard.openrouteservice.org/), [Matrix API](https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/). Đây là đường dẫn để tự cấu hình, không có key dùng chung được đưa lên Git.

## 3. Dữ liệu bắt buộc trước khi lập lịch

Clone code không có dữ liệu địa điểm cá nhân/volume. Chỉ có collection vector mà SQLite catalog rỗng thì chưa đủ để lập lịch. Đồng bộ cùng `place_id` vào catalog AI và index qua API địa điểm đã có trên dev; xem [Search](../semantic_search/README.md) và [Recommendation](../recommendation/README.md). `POST /api/v1/places/batch` nhận `{ "places": [...] }`; mỗi địa điểm cần tối thiểu ID, tên, thành phố, loại, tọa độ hợp lệ. Các trường chính xác xem `/docs`.

Planner hiện dùng `Attraction`/`Restaurant` có tọa độ, không tự tạo địa điểm. Cần đủ điểm trong thành phố, mô tả/tags phù hợp, thời lượng tham quan và giờ mở cửa càng đầy đủ càng tốt. Dữ liệu thiếu/không đủ lịch khả thi sẽ được cảnh báo hoặc trả lỗi; không dùng dữ liệu giả để che lỗi. Sao lưu cả volume AI data và Qdrant; không xóa volume để “sửa” lỗi.

## 4. API chat để backend/frontend nối

`POST /api/v1/chat`

Headers: `Content-Type: application/json`, `X-API-Key: <RECOMMENDATION_API_KEY>`.

```json
{
  "user_id": "backend-user-123",
  "message": "Lập lịch Đà Nẵng 3 ngày, thích biển và ẩm thực",
  "use_llm": true,
  "preview_only": true
}
```

Giữ `conversation_id` từ response và gửi lại trong các lượt sau, cùng user đã xác thực:

```json
{
  "user_id": "backend-user-123",
  "conversation_id": "ID-trong-response-truoc",
  "message": "01/12/2026, 2 người, ô tô, tham quan 9h–18h",
  "use_llm": true,
  "preview_only": true
}
```

Ngày ví dụ chỉ để minh họa; khi thử phải chọn ngày tương lai. Backend nên đặt timeout khoảng **180 giây** cho lập lịch vì routing chia nhiều block và có retry. Không tự retry POST tạo lịch nếu chưa kiểm tra session/kết quả để tránh tạo nhiều preview.

Ví dụ fetch ở **backend Node.js** (không đặt đoạn chứa service key này trong frontend):

```javascript
const response = await fetch(`${process.env.AI_BASE_URL}/api/v1/chat`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-API-Key': process.env.AI_API_KEY},
  signal: AbortSignal.timeout(180000),
  body: JSON.stringify({
    user_id: authenticatedUser.id,
    message: input.message,
    conversation_id: storedConversationId || undefined,
    use_llm: true,
    preview_only: true
  })
});
if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
const data = await response.json();
// Lưu conversation_id theo authenticatedUser; phân nhánh status/intent ở bảng dưới.
// Không coi HTTP 200 là đã tạo lịch: có thể đang hỏi thêm hoặc provider tạm lỗi.
```

Trong env **backend**, `AI_BASE_URL` là base URL nêu trên; `AI_API_KEY` phải bằng `RECOMMENDATION_API_KEY` của AI. Đây là tên biến phía backend, không phải một key mới cần đăng ký.

### Thông tin phải đủ

`city`, `start_date`, `days` (1–14), `preferences`, `party_size`, `transport`, `daily_window`. Chat hỏi tối đa 2 thông tin còn thiếu mỗi lượt. “Dùng mặc định” chỉ bổ sung 1 người, ô tô và 09:00–18:00, không tự chọn ngày/thành phố/sở thích. `transport`: `driving`, `walking`, `cycling`; máy bay không phải phương tiện tại điểm đến.

Chat mặc định `fill_day=true`: thêm điểm còn xếp vừa giờ, không dừng cứng ở 3 điểm/ngày. Ngân sách tối đa 480 phút tính tham quan/đi đường/chờ, giờ nghỉ tính riêng; không kéo dài giả thời lượng hoặc vi phạm giờ mở cửa cho đủ khung. API cấu trúc cũ giữ `fill_day=false` để tương thích, muốn tận dụng giờ phải gửi `true`.

### Response và cách render

Các nhánh trả HTTP 200 có status nghiệp vụ; phải đọc status, không chỉ nhìn HTTP:

| `status`/nhánh | Hành động của frontend/backend |
|---|---|
| `needs_clarification` | Hiện `message`; giữ session; `trip` có thể null. |
| `preview_created` / `preview_updated` | Hiện `message`; render `trip.days[].activities`; giữ ID/version preview. Chưa lưu vào PostgreSQL. |
| `temporarily_unavailable` | Hiện `message` thân thiện; không xóa lịch trước đó; cho phép thử lại. |
| `new_trip` | Thay session bằng ID mới, xóa lịch đang hiển thị của phiên trước. |
| `saved` | Chỉ lưu vào kho AI cục bộ qua yêu cầu lưu rõ ràng; không đồng nghĩa lưu lịch sản phẩm. |
| `intent=general_chat` | Hiện `result.answer`, không nhất thiết có status ở cấp ngoài. |
| `intent=place_search` | Hiện `result.answer`, `result.results`. |
| `intent=recommendation` | Hiện `result.answer`, `result.recommendations`. |
| `intent=travel_qa` | Hiện `result.answer`, thông tin có căn cứ trong `result.facts` nếu có. |

Ví dụ rút gọn (không phải toàn bộ schema):

```json
{
  "conversation_id": "uuid",
  "intent": "trip_planning",
  "status": "needs_clarification",
  "message": "Bạn muốn khởi hành ngày nào?",
  "trip": null,
  "extraction": {"draft": {"city": "Đà Nẵng", "days": 3}}
}
```

Khi thành công, `trip` chứa `trip_id`, `draft_id`, `version`, `user_id`, `city`, `start_date`, `timezone`, `days`, `routing`, `warnings`, `status`, `summary`, `preview_only=true`, `saved=false`. Lấy ID từ `trip.draft_id` (hoặc `trip.trip_id`), không giả định có `draft_id` ở cấp ngoài response chat.

Mỗi ngày có `date`, `window`, `activities`, `end_time`, tổng phút/km, `remaining_window_minutes`, `completion_reason`, `validation`. Hoạt động có ID/tên/tọa độ, `start_time`/`end_time`, thời lượng và chặng từ điểm trước. `routing.source=ors`, `estimated=false` đối với preview ORS. Lịch có thể `partial`; phải hiện cảnh báo/điểm bắt buộc chưa xếp, không hiển thị thành hoàn tất tuyệt đối.

Không render `extraction`, raw JSON hoặc cấu hình nội bộ thành bong bóng chat. Frontend render message/answer và một khung lịch riêng. Khi chưa biết tên ngày/địa điểm duy nhất để sửa, giữ lịch cũ và chờ người dùng làm rõ.

## 5. Preview API có cấu trúc

| Method / path | Input chính | Kết quả |
|---|---|---|
| `POST /api/v1/trips/preview` | `TripRequest` đầy đủ | `{draft_id, version, request, result}`; ORS bắt buộc, không fallback ước tính. |
| `GET /api/v1/trips/previews/{id}?user_id=...` | Chủ sở hữu | Cùng wrapper preview. |
| `PATCH /api/v1/trips/previews/{id}/days/{day}` | `user_id`, `expected_version`, add/remove/reorder | Wrapper preview phiên bản mới. |
| `DELETE /api/v1/trips/previews/{id}?user_id=...` | Chủ sở hữu | 204. |
| `POST /api/v1/trips/extract` | `message`, `context`, `use_llm` | Các trường đã trích xuất + draft + thông tin còn thiếu; không tự tạo lịch. |

Ví dụ tạo preview:

```json
{
  "user_id": "backend-user-123",
  "city": "Đà Nẵng",
  "start_date": "2026-12-01",
  "days": 3,
  "party_size": 2,
  "preferences": ["biển", "ẩm thực"],
  "transport": "driving",
  "daily_window": {"start": "09:00", "end": "18:00"},
  "fill_day": true
}
```

Ví dụ sửa ngày (ID phải có thật trong catalog, không được nằm ở ngày khác):

```json
{
  "user_id": "backend-user-123",
  "expected_version": 1,
  "remove_place_ids": ["place-id-cu"],
  "add_place_ids": ["place-id-moi"]
}
```

`expected_version` lấy từ preview vừa đọc; không tự tăng ở client. Conflict thì đọc lại trước khi sửa. Preview hết hạn sau 24 giờ; DB tự tạo bảng cần thiết khi dùng, không cần PostgreSQL migration. Dữ liệu lưu AI cục bộ không phải cơ chế xác thực/đăng nhập đa người dùng.

## 6. Lỗi và lưu lịch sản phẩm

- 401: sai/thiếu service key. 422: input không hợp lệ. 404: preview không tồn tại, khác chủ hoặc hết hạn. 409: xung đột version. 503/`temporarily_unavailable`: Gemini/ORS/network/quota. Kiểm tra log server; không đưa raw lỗi/provider body ra UI.
- Gemini lỗi: kiểm tra đúng model/quyền/quota; key không đảm bảo mọi request thành công. Client có retry hữu hạn, không retry vô tận. `use_llm=false` dùng luồng rule có giới hạn, không tương đương hiểu ngôn ngữ tự nhiên bằng Gemini.
- ORS lỗi: kiểm tra key, profile và quota. `ORS_PROFILES` bật profile ở AI không tự cấp quyền provider. Không tự thay ma trận thật bằng khoảng cách giả.
- Backend chỉ lưu PostgreSQL khi user chọn lưu. Tự map các `place_id` và thời gian về schema sản phẩm, kiểm tra quyền và dữ liệu bắt buộc; AI không tự ghi database backend. Gửi lại `conversation_id` đúng user cho các lượt sau.
- `save_trip` trong chat hiện dùng kho AI cục bộ để hỗ trợ thử nghiệm. Khi tích hợp lưu sản phẩm, backend chịu trách nhiệm luồng lưu chính thức; đừng coi `saved_trip_id` này là ID PostgreSQL.

## 7. Kiểm thử và giới hạn đã biết

Trong `ai/`: `python -m unittest discover -s tests -q`. Test dùng model/routing giả lập và DB tạm, không cần provider key. Live runner: `python scripts/evaluate_chat_orchestration.py --label round3`; holdout chỉ chạy sau chốt bằng `--label final --split holdout`. Runner cần fixture trong `tests/`, không có trong runtime image Docker; chạy native hoặc mount đầy đủ thư mục AI. Kết quả sinh trong `ai/data/chat-orchestration/`, không commit.

Bộ TC31–TC85 và partition development/holdout nằm trong `tests/fixtures/chat_orchestration_cases.json`. Các JSON kết quả thử nghiệm, dữ liệu thật và UI demo không nằm trong commit bàn giao. Chạy live có sử dụng quota Gemini.

Kết quả live trên môi trường phát triển: development 41/42, holdout 9/13; regression của workspace trước tách 217/217. Bản bàn giao sạch từ dev chạy 203 test: 202 đạt, 1 bỏ qua benchmark tùy chọn không thuộc gói bàn giao; không có lỗi. Còn hạn chế TC53/TC68/TC69 về thời lượng mơ hồ, TC59 về intent phương tiện, TC72 về số người tương đối. Không dùng con số này để khẳng định chatbot hiểu đúng mọi câu. Trường quan trọng nên được UI xác nhận/cho sửa trước khi lưu chính thức. Chỉ kiểm tra định dạng không thay thế kiểm tra ý nghĩa đầu vào.
