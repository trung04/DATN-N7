# Recommendation — hướng dẫn tích hợp

Hai phương án đối chứng nội dung thuần đã bổ sung: gửi `mode: "tfidf"` hoặc `mode: "semantic"` vào cùng `POST /api/v1/recommendations`. Cả hai dùng cùng văn bản địa điểm và bộ lọc, cùng cách tổng hợp sở thích khai báo; không đọc lịch sử, không cộng Rating, không MMR. `semantic` dùng cosine BGE-M3; `tfidf` dùng cosine TF-IDF word 1–2 gram, bỏ dấu/chữ thường, sublinear TF, smooth IDF và chuẩn hóa L2. TF-IDF fit trên catalog hoạt động, cache trong RAM và tự làm mới khi catalog đổi; không dùng nhãn test để fit.

Điểm nội dung thuần trả ở `score`/`content_score`; `quality_score: 0` chỉ đánh dấu Rating không tham gia, không có nghĩa địa điểm chất lượng bằng 0. Khi thiếu sở thích hoặc toàn bộ từ ngoài từ vựng TF-IDF, baseline trả danh sách rỗng kèm cảnh báo thay vì âm thầm dùng Rating. `auto` vẫn giữ luồng sản phẩm bên dưới. Bộ so sánh, dữ liệu và giới hạn kết luận được mô tả ở `evaluation/RECOMMENDATION.md`.

## Cơ chế mặc định `auto`

Backend chỉ gọi một API `POST /api/v1/recommendations`, không cần tự kiểm tra lịch sử hoặc tự chọn thuật toán.

| Dữ liệu của user | Xử lý khi bỏ `mode` hoặc gửi `auto` |
| --- | --- |
| Chưa có sự kiện, có sở thích/nhu cầu | Content-Based BGE-M3 + Bayesian Rating; không MMR |
| Chưa có sự kiện, không có sở thích/nhu cầu | Bayesian Rating dự phòng |
| Có sự kiện hành vi | Tổng hợp hồ sơ hành vi + sở thích khai báo, kết hợp Rating, xếp lại bằng MMR |
| Có sự kiện nhưng không có vector hành vi tích cực hợp lệ | Vẫn MMR, dùng sở thích/nhu cầu hoặc Rating dự phòng; loại điểm bị đánh giá thấp, trả cảnh báo |

Chỉ việc có user hoặc lưu sở thích **không** được coi là có lịch sử hành vi. Các lần AI trả danh sách được lưu riêng để hỗ trợ đổi gợi ý, **không** kích hoạt cá nhân hóa. Không có dữ liệu tương tác giả được tự tạo.

Hồ sơ được tính lại khi gọi Recommendation sau khi nhận sự kiện. Không huấn luyện lại BGE, không dùng Item-KNN/Collaborative Filtering. Quy tắc `auto` xét các sự kiện đã lưu không muộn hơn thời điểm xử lý của chính user đó. Một sự kiện hợp lệ đã đủ bật chế độ hành vi; `history_available` cho biết thực sự tạo được vector hành vi hay chưa.

## Cách nối từ backend

1. Backend xác thực người dùng và lấy `user_id` từ phiên đăng nhập; không tin ID tự nhập ở frontend.
2. Đảm bảo địa điểm đã có trong catalog AI, dùng thống nhất `place_id` giữa sự kiện và catalog. ID là chuỗi, không mặc định UUID backend.
3. Gửi sở thích khai báo bằng PUT preferences (nếu có).
4. Khi người dùng xem chi tiết, yêu thích, lưu hay đánh giá địa điểm, gửi sự kiện tương ứng sang AI. Backend nên lưu/retry sự kiện bằng cùng `event_id` khi lỗi mạng.
5. Gọi Recommendation với cùng `user_id`, bỏ `mode` hoặc gửi `auto`; hiển thị danh sách theo đúng thứ tự API trả về, cùng `warnings` khi có.

Base URL nội bộ Docker `http://ai:9000`; máy demo hiện tại `http://localhost:9002`. Header mọi API: `Content-Type: application/json` và `X-API-Key: <RECOMMENDATION_API_KEY>`. Key chỉ nằm ở backend. Nếu server không cấu hình key thì đang tắt xác thực; phải cấu hình khi triển khai. Đây là service API, không phải hệ thống đăng nhập của người dùng cuối.

Sự kiện, sở thích và kết quả đề xuất được lưu trong SQLite của AI (`RECOMMENDATION_DB_PATH`), cần giữ volume để không mất khi tạo lại container. Không cần chạy migration PostgreSQL cho tính năng này; các bảng/index bổ sung được tạo nếu chưa có, không xóa dữ liệu cũ.

## 1. Gọi đề xuất: POST /api/v1/recommendations

Request sử dụng trong sản phẩm:

```json
{
  "user_id": "user-123",
  "mode": "auto",
  "city": "Đà Nẵng",
  "preferences": ["biển", "thiên nhiên"],
  "limit": 10
}
```

`preferences` có thể bỏ: AI đọc sở thích đã lưu của user. Gửi `[]` nghĩa là không dùng sở thích khai báo ở lần gọi này, **không tắt lịch sử hành vi**. Không gửi sở thích giống nhau lặp lại để tăng trọng số.

| Trường | Kiểu / mặc định | Ý nghĩa |
| --- | --- | --- |
| `user_id` | string, bắt buộc, 1–128 ký tự | Danh tính từ backend |
| `mode` | `auto` (mặc định), `tfidf`, `semantic`, `content_rating`, `personalized_mmr` | Các chế độ chỉ định dành cho đối chứng/debug; `tfidf`/`semantic` bỏ Rating, lịch sử và MMR; `content_rating` bỏ lịch sử và MMR |
| `preferences` | string[] hoặc null, tối đa 30 | Sở thích khai báo; không gửi/null thì đọc sở thích đã lưu |
| `query` | string hoặc null, 1–2000 ký tự | Nhu cầu chuyến đi hiện tại, được giữ riêng với hồ sơ dài hạn |
| `city`, `place_type`, `category`, `budget` | string hoặc null | Lọc bắt buộc; type: `Hotel`/`Restaurant`/`Attraction`; budget là nhãn có sẵn, không phải tiền |
| `family_friendly` | boolean hoặc null | Lọc theo dữ liệu catalog |
| `latitude`, `longitude`, `radius_km` | number hoặc null | Tọa độ phải đi cùng nhau; radius >0 và ≤1000 km, cần tọa độ; khoảng cách thẳng |
| `exclude_place_ids` | string[], tối đa 500 | Loại trừ bắt buộc |
| `limit` | integer 1–100, mặc định 10 | Top K, có thể trả ít hơn nếu không đủ ứng viên |
| `include_service_places` | boolean, mặc định false | Mặc định bỏ các mục kinh doanh dịch vụ không phù hợp đi tham quan |
| `preference_alpha` | number 0..1, mặc định 0.5 | Cân bằng sở thích khai báo và lịch sử khi có cả hai |
| `mmr_lambda` | number 0..1, mặc định 0.7 | Cao: ưu tiên phù hợp; thấp: tăng phạt tương đồng |
| `mmr_pool_size` | integer 1–500, mặc định 100 | Tập xếp lại; phải ≥ limit với `auto`/`personalized_mmr` |
| `refresh_variety` | boolean, mặc định true | Trong chế độ hành vi, cố gắng đổi khoảng 30% danh sách giữa các lần; false để tắt luân phiên |

Response **200**, ví dụ minh họa user đã có lịch sử (điểm/ID chỉ minh họa):

```json
{
  "request_id": "2bf662ac-a918-44aa-b5f1-de3e7b746270",
  "user_id": "user-123",
  "total": 1,
  "strategy": "personalized_mmr",
  "model_version": "content-rating-v1-example",
  "retrieval": "qdrant",
  "recommendations": [{
    "place_id": "place-my-khe",
    "name": "Bãi biển Mỹ Khê",
    "place_type": "Attraction",
    "city": "Đà Nẵng",
    "score": 0.875,
    "content_score": 0.8,
    "quality_score": 0.8,
    "mmr_score": 0.6125,
    "redundancy_score": 0.0,
    "fresh_since_last": false,
    "rating": 4.5,
    "review_count": 100,
    "distance_km": null,
    "image_url": null,
    "effective_weights": {"quality": 0.25, "content": 0.75},
    "reasons": ["Điểm chất lượng Bayesian từ rating và số lượt đánh giá", "Cá nhân hóa từ hành vi + MMR"]
  }],
  "diagnostics": {
    "mode": "personalized_mmr",
    "requested_mode": "auto",
    "selection_reason": "history_present",
    "history_event_count": 1,
    "history_available": true,
    "history_places_used": 1,
    "preference_alpha": 0.5,
    "mmr_lambda": 0.7,
    "score_is_probability": false
  },
  "warnings": []
}
```

`diagnostics` có thể có thêm thông tin ứng viên, vector thiếu, trọng số hành vi và luân phiên. User mới trả `diagnostics.mode: "content_rating"`, `selection_reason: "no_history"`, `history_event_count: 0`; `mmr_score`/`redundancy_score` là null. `strategy` có thể là `content_rating`, `rating_fallback`, `personalized_mmr` hoặc `rating_mmr_fallback`.

- `content_score` là độ phù hợp trong [-1,1], được đổi thành `(content_score+1)/2` trước khi cộng điểm.
- Mặc định `score = 0.75 * content_normalized + 0.25 * quality_score`. Nếu thiếu điểm nội dung, dùng chất lượng với trọng số 1. Trọng số có thể đổi bằng biến môi trường; đọc `effective_weights` và `/recommendation/status` để biết giá trị thật.
- `mmr_score` là điểm lựa chọn ở bước MMR, **không phải** xác suất và không thay thế `score`. Giữ thứ tự API trả về, không sort lại theo `score` ở frontend.
- `fresh_since_last` chỉ phản ánh thay đổi so với danh sách trước khi có luân phiên, không phải địa điểm mới trong catalog. Không đảm bảo mỗi lần luôn đổi nếu thiếu ứng viên phù hợp.
- `total` là số mục thực trả về. Không tự nới bộ lọc khi thiếu kết quả; `warnings` mô tả các giới hạn.

## 2. Gửi hành vi: POST /api/v1/users/{user_id}/interactions

Ví dụ xem chi tiết:

```json
{
  "event_id": "unique-event-001",
  "place_id": "place-my-khe",
  "action": "view",
  "occurred_at": "2026-11-23T10:00:00Z"
}
```

Yêu thích/lưu cần `active`:

```json
{"event_id":"unique-event-002","place_id":"place-my-khe","action":"favorite","active":true,"occurred_at":"2026-11-23T10:01:00Z"}
```

```json
{"event_id":"unique-event-003","place_id":"place-my-khe","action":"save","active":true,"occurred_at":"2026-11-23T10:02:00Z"}
```

Đánh giá cần `rating` (1..5), không gửi `active`:

```json
{"event_id":"unique-event-004","place_id":"place-my-khe","action":"rating","rating":5,"occurred_at":"2026-11-23T10:03:00Z"}
```

Backend phải thay `occurred_at` bằng thời điểm sự kiện thật, có timezone, không nằm trong tương lai. Bỏ yêu thích/lưu: tạo sự kiện mới, cùng action nhưng `active:false`. Xem nhiều lần: mỗi lần là event ID khác; gửi lại do retry phải giữ nguyên ID và nội dung. Không tự sinh hành vi khi chỉ gọi Recommendation.

Response **200**:

```json
{"event_id":"unique-event-001","created":true}
```

Retry cùng ID/nội dung/user: `created:false`, không cộng đôi. ID đã dùng cho nội dung hoặc user khác: **409**. Chưa có địa điểm hoạt động trong AI catalog: **404**. Event ID phải duy nhất toàn hệ thống, nên dùng UUID hoặc ID sự kiện backend.

## 3. Các API còn lại

| API | Request / response |
| --- | --- |
| `PUT /api/v1/users/{user_id}/preferences` | Body `{"preferences":["biển","cà phê"]}` → `{"user_id":"user-123","preferences":["biển","cà phê"]}`; thay toàn bộ sở thích khai báo |
| `GET /api/v1/users/{user_id}/preferences` | Cùng cấu trúc trên; user chưa lưu trả danh sách rỗng |
| `GET /api/v1/users/{user_id}/interactions?limit=100&offset=0` | `{"user_id":"user-123","total":1,"items":[...],"positive_place_weights":{"place-my-khe":1.0},"negative_place_ids":[]}`; items mới nhất trước, chứa nguyên event và `place_name`; limit 1–200 |
| `DELETE /api/v1/users/{user_id}/interactions` | Thao tác xóa lịch sử có chủ đích → `{"user_id":"user-123","deleted":1}`; giữ sở thích; lần gọi auto tiếp theo trở lại mặc định nếu đã hết lịch sử |
| `GET /api/v1/recommendations/{request_id}` | Đọc lại đúng `RecommendationResponse` đã lưu; không tính lại. Backend phải kiểm tra `user_id` thuộc phiên trước khi trả frontend |
| `GET /api/v1/recommendation/status` | `mode: "auto"`, `supported_modes`, model/vector collection, số địa điểm/vector chờ đồng bộ và `ranking_config` |
| `POST /api/v1/recommendation/reindex?limit=100` | Bảo trì đồng bộ vector còn thiếu; response `saved`, `pending_index`, `items`; không cần gọi trong luồng gợi ý thường |

Mọi API được bảo vệ bằng cùng service key. Không gọi DELETE để làm mới danh sách gợi ý; đây là xóa dữ liệu hành vi thật.

## Thuật toán đang áp dụng

1. Lọc địa điểm hoạt động theo điều kiện, loại trừ và quy tắc địa điểm dịch vụ; lấy vector BGE đã lưu. Không nhúng lại địa điểm khi ghi hành vi.
2. Sở thích khai báo được gom nhóm gần nghĩa (mặc định tối đa 3 nhóm); nhu cầu `query` của lần gọi được giữ riêng.
3. Khi có lịch sử: view = 1, view lặp tối đa tổng 2 mỗi địa điểm; favorite = 3 khi đang bật; save = 4 khi đang bật. Đánh giá cộng `5 * max(0,(rating-3)/2)`; 3 sao trung tính, dưới 3 sao loại trừ địa điểm. Trạng thái yêu thích/lưu/đánh giá lấy mới nhất theo occurred_at, hòa thì event_id.
4. Vector hành vi là tổng có trọng số các vector địa điểm tích cực rồi chuẩn hóa. Kết hợp vector sở thích và hành vi với alpha (mặc định 0.5); chỉ có một nguồn thì dùng nguồn đó. Không áp dụng suy giảm theo thời gian trong phiên bản này.
5. Điểm nội dung dựa trên cosine. Nếu có query hiện tại và hồ sơ, kết hợp 70% query + 30% hồ sơ; không có query thì dùng hồ sơ. Chất lượng Bayesian dựa trên rating + review_count của catalog, prior theo thành phố/loại, strength mặc định 50; chuẩn hóa về [0,1].
6. Kết hợp nội dung/chất lượng theo trọng số chuẩn hóa (mặc định 75%/25%), khử địa điểm trùng tên. Vector thiếu chỉ dùng chất lượng, kèm cảnh báo. Nếu Qdrant không truy xuất được thì dùng tính nội dung trực tiếp trên các vector hiện có.
7. Chỉ chế độ hành vi áp dụng `MMR = lambda * score - (1-lambda) * max(similarity_to_selected)`; độ tương đồng giữa địa điểm đổi về [0,1]. Nếu thiếu vector, không coi đó là bằng chứng mới lạ.
8. Khi bật refresh_variety, giữ điểm neo và cố gắng đổi khoảng 30% từ tập ứng viên phù hợp chưa hiện ở danh sách gần đây. Không chèn ngẫu nhiên địa điểm kém phù hợp. Đặt false khi cần thực nghiệm thứ hạng ổn định.

Lưu ý: trọng số hành vi/alpha/lambda là cấu hình khởi tạo, chưa phải tham số tối ưu được chứng minh bằng đánh giá. Nhận sự kiện mới cập nhật hồ sơ ở lần truy vấn tiếp theo, không phải online training model.

## Lỗi, hợp đồng và kiểm thử

- **401**: `{"detail":"API key không hợp lệ"}` khi thiếu/sai key.
- **404**: địa điểm hoạt động hoặc request_id không tồn tại, body `{"detail":"..."}`.
- **409**: event_id xung đột nội dung/user, body `{"detail":"..."}`.
- **422**: giá trị ngoài phạm vi, sai action/active/rating, timestamp không timezone hoặc tương lai; `detail` là chuỗi hoặc danh sách lỗi Pydantic. Không phụ thuộc nguyên văn thông báo.
- **500/lỗi mạng**: backend báo thất bại, retry có giới hạn; không tạo sự kiện ID mới cho cùng một lần retry.

OpenAPI riêng: `ai/contracts/recommendation.openapi.json`. Chạy kiểm thử trong `ai/`: `python -m unittest discover -s tests -q`. Không cần giao diện demo để dùng các API này.
