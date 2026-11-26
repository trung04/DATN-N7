# Tích hợp API tìm kiếm địa điểm bằng text

Phạm vi: tìm kiếm text và tạo vector text. Không cần giao diện demo, Gemini, lịch sử người dùng hay chatbot. Backend gọi AI bằng service key, không gửi key xuống frontend.

## Kết nối và luồng gọi

- Base URL nội bộ Docker: `http://ai:9000`; máy đang cấu hình AI cổng 9002: `http://localhost:9002`.
- Header: `Content-Type: application/json`, `X-API-Key: <RECOMMENDATION_API_KEY>`.
- Backend gửi thẳng truy vấn tới `POST /api/v1/search/places`; **không cần gọi embedding trước**.
- Catalog phải được đồng bộ trước bằng API dữ liệu hiện có. Tạo vector text đơn thuần không thêm địa điểm vào catalog.
- Hybrid mặc định: cosine BGE + BM25, gộp RRF (`k=60`), ưu tiên tên khớp chính xác. `bge` và `bm25` thuần phục vụ đối chứng; không có ưu tiên tên. Không dùng rating/hành vi để cộng điểm tìm kiếm.
- Tìm kiếm hiện đọc catalog và vector đã lưu trong AI database, tính cosine chính xác trong RAM; không gọi Qdrant để truy vấn Top K. Qdrant vẫn thuộc luồng đồng bộ dữ liệu hiện có.

## 1. POST /api/v1/search/places

### Phương án dùng cho sản phẩm: Hybrid BGE-M3 + BM25

Luồng: nhận query và filters → lọc catalog → tính cosine BGE và điểm BM25 → xếp hạng riêng hai nguồn → gộp `RRF(p) = 1/(60 + rank_BGE(p)) + 1/(60 + rank_BM25(p))` → ưu tiên tên khớp chính xác → phân trang. Nếu địa điểm không có trong một nguồn thì nguồn đó không đóng góp điểm RRF. Rank bắt đầu từ 1. Không cộng trực tiếp điểm cosine với điểm BM25.

Thành viên tích hợp chỉ cần gọi API dưới đây với `method: "hybrid"` (hoặc bỏ trường này vì đã mặc định Hybrid), giữ `place_id` để lấy chi tiết bằng API catalog hiện có. Không cần gọi hai API BGE/BM25 riêng và không gộp kết quả ở frontend. Các chế độ thuần vẫn được giữ làm đối chứng cho báo cáo.

Đánh giá ban đầu trên cùng 36 truy vấn × 3 lượt: Hybrid đạt Recall@10 = 0.5204, MRR@10 = 1.0000, nDCG@10 = 0.9590; latency HTTP trung bình khoảng 748 ms trên máy thử nghiệm. Đây là nhãn silver/nháp, chưa phải kết luận chất lượng production; pipeline Hybrid còn có ưu tiên tên và tăng trọng số tên ở nguồn từ khóa.

Request:

```json
{
  "query": "bãi biển yên tĩnh",
  "method": "hybrid",
  "filters": {"city": "Đà Nẵng", "place_type": "Attraction"},
  "infer_filters": false,
  "limit": 10,
  "offset": 0
}
```

| Trường | Kiểu / mặc định | Ý nghĩa |
| --- | --- | --- |
| `query` | string, bắt buộc, 1–2000 ký tự | Không nhận chuỗi trắng hoặc chỉ dấu câu |
| `method` | `hybrid` / `bge` / `bm25`; mặc định `hybrid` | Phương pháp xếp hạng |
| `filters` | object, mặc định `{}` | Điều kiện bắt buộc, dùng giống nhau cho cả ba phương pháp |
| `infer_filters` | boolean, mặc định `true` | Tự nhận diện thành phố, loại, tiện ích bằng luật; không phải LLM. Đặt `false` nếu backend đã có bộ lọc |
| `sort_by` | `relevance` (mặc định), `name`, `rating` | Sắp xếp toàn bộ kết quả trước khi phân trang. Khi trùng tên hoặc điểm đánh giá, giữ thứ tự phù hợp |
| `sort_order` | `asc` (mặc định), `desc` | Chiều sắp xếp theo tên hoặc điểm đánh giá |
| `limit` | integer 1–100; mặc định 10 | Số kết quả mỗi trang |
| `offset` | integer 0–10000; mặc định 0 | Vị trí bắt đầu, trang tiếp theo = offset + limit |
| `min_similarity` | number -1..1 hoặc null | Ngưỡng cosine; không được gửi với `bm25` |

Các trường `filters` (đều tùy chọn):

| Trường | Kiểu / giới hạn |
| --- | --- |
| `city` | string |
| `place_type` | `Hotel`, `Restaurant`, `Attraction` |
| `category` | string; khớp danh mục sau chuẩn hóa |
| `amenities` | string[], tối đa 30; phải có đủ các tiện ích |
| `excluded_amenities` | string[], tối đa 30; không được trùng `amenities`; thiếu dữ liệu tiện ích không được coi là bằng chứng không có tiện ích |
| `budget` | string; nhãn có sẵn trong catalog, không phải số tiền |
| `family_friendly` | boolean |
| `min_rating` | number 1..5; chỉ lọc, không cộng điểm |
| `latitude`, `longitude` | number trong [-90,90], [-180,180]; phải đi cùng nhau |
| `radius_km` | number >0, tối đa 1000; cần tọa độ tham chiếu |
| `exclude_place_ids` | string[], tối đa 500 |

Giá trị bộ lọc gửi rõ ràng được ưu tiên hơn giá trị tự nhận diện. API không tự nới điều kiện khi không có kết quả.

Response **200**, ví dụ minh họa một kết quả:

```json
{
  "request_id": "af6be39d-d64a-4226-aa39-0a0f094d9700",
  "query": "bãi biển yên tĩnh",
  "parser": "vietnamese_rules_v1",
  "inferred_filters": {},
  "applied_filters": {
    "city": "Đà Nẵng",
    "place_type": "Attraction",
    "amenities": [],
    "excluded_amenities": [],
    "exclude_place_ids": []
  },
  "unsupported_requirements": [],
  "warnings": [],
  "retrieval": "local_exact_bge_bm25_rrf",
  "model": "BAAI/bge-m3:1024:facts-v2",
  "total": 1,
  "offset": 0,
  "limit": 10,
  "results": [{
    "place_id": "place-my-khe",
    "name": "Bãi biển Mỹ Khê",
    "place_type": "Attraction",
    "city": "Đà Nẵng",
    "score": 0.03278688524590164,
    "semantic_score": 0.81,
    "keyword_score": 2.31,
    "exact_name_match": false,
    "distance_km": null,
    "image_url": null,
    "reasons": ["Khớp từ khóa trong tên hoặc nội dung", "Đã xếp hạng theo độ tương đồng ngữ nghĩa BGE"]
  }]
}
```

- `total`: tổng số kết quả đạt điều kiện trước phân trang, không phải số phần tử của trang.
- `score`: điểm xếp hạng của phương pháp đang chọn; không phải xác suất và không so trực tiếp giữa các phương pháp.
- `semantic_score`: cosine BGE, null ở BM25 hoặc khi thiếu vector hợp lệ. `keyword_score`: điểm BM25; bằng 0 trong BGE thuần.
- `exact_name_match`: tên khớp sau chuẩn hóa. `distance_km`: khoảng cách thẳng tới tọa độ tham chiếu, không phải khoảng cách lái xe; null khi không đủ tọa độ.
- `image_url`: URL ảnh hoặc null; frontend tự đặt ảnh dự phòng. API không tải ảnh trong truy vấn text.
- `reasons`: giải thích nguồn xếp hạng; `warnings` và `unsupported_requirements` cần được hiển thị khi có, không khẳng định thỏa điều kiện chưa hỗ trợ.
- `retrieval`: `local_exact_bge_bm25_rrf`, `local_exact_bge` hoặc `bm25`. `model` của BM25 là `BM25(k1=1.2,b=0.75)`.
- Không có kết quả vẫn trả **200**, `total: 0`, `results: []`; kiểm tra `warnings`. ID là chuỗi của catalog AI, không mặc định là UUID backend.
- Đây là endpoint không lưu lịch sử và không phân trang ngẫu nhiên. Thứ hạng có thể đổi khi dữ liệu/model thay đổi.

## 2. POST /api/v1/embeddings/text

Chỉ tạo vector; không ghi catalog/Qdrant, không tìm địa điểm.

Request:

```json
{"text": "bãi biển yên tĩnh"}
```

Response **200** có `model` (string), `dimensions` (integer), `embedding` (number[] dài đúng `dimensions`). Ví dụ dưới dùng model kiểm thử 4 chiều để không in 1024 phần tử; BGE-M3 thực tế trả 1024 chiều:

```json
{"model": "test-model", "dimensions": 4, "embedding": [0.5, 0.5, 0.5, 0.5]}
```

## 3. POST /api/v1/embeddings/batch

Request: khóa tên **`text`**, không phải `texts`; từ 1 đến 100 chuỗi.

```json
{"text": ["bãi biển yên tĩnh", "quán cà phê"]}
```

Response **200**: `embeddings[i]` tương ứng `text[i]`, cùng số chiều. Ví dụ model kiểm thử:

```json
{"model": "test-model", "dimensions": 4, "embeddings": [[0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]}
```

Embedding text dùng giới hạn `MAX_TEXT_LENGTH` (mặc định 8000 ký tự/chuỗi). API này không tự gọi Gemini.

## Lỗi và lưu ý vận hành

- **401**: thiếu/sai key khi server đã cấu hình `RECOMMENDATION_API_KEY`: `{"detail":"API key không hợp lệ"}`. Key rỗng trong server nghĩa là đang tắt xác thực; cấu hình key khi triển khai.
- **422**: request sai kiểu/giới hạn, query rỗng, bộ lọc mâu thuẫn. Pydantic trả `{"detail":[{"loc":["body","limit"],"msg":"...","type":"...","input":0}]}`; trường `ctx` có thể xuất hiện. Không phụ thuộc nguyên văn `msg`.
- **400**: endpoint embedding nhận văn bản không hợp lệ hoặc batch >100: `{"detail":"..."}`.
- **500** hoặc lỗi kết nối: lỗi hạ tầng/model không dự kiến; backend cần timeout và thông báo thất bại, không coi là danh sách rỗng thành công.
- Hybrid có thể trả kết quả từ khóa khi vector địa điểm chưa sẵn sàng, kèm cảnh báo; BGE thuần bỏ các điểm thiếu vector đúng model. BM25 không gọi embedding truy vấn.
- Chưa kiểm chứng giá tiền, khoảng cách tới bờ biển hay giờ mở cửa theo thời gian thực. `radius_km` dùng khoảng cách thẳng.
- BM25 hiện tính trong RAM với IDF trên tập sau lọc; chuẩn hóa chữ thường/bỏ dấu, token âm tiết, stopwords; chưa dùng inverted index quy mô lớn.

## Cấu trúc và kiểm thử

- `text_router.py`: ba HTTP API text; `text_schemas.py`: request/response.
- `text_search.py`: bộ lọc, cosine và RRF; `bm25.py`: baseline BM25; `text_utils.py`: chuẩn hóa và luật tiếng Việt.
- `schemas.py` giữ export tương thích với code gọi cũ; router ảnh/catalog giữ nguyên chức năng. Không phụ thuộc demo.
- OpenAPI riêng: `ai/contracts/text-search.openapi.json`; schema runtime đầy đủ: `/openapi.json`.
- Chạy trong `ai/`: `python -m unittest discover -s tests -q`.
