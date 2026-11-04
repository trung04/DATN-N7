# Natural-language place search

POST `/api/v1/search/places`. API tìm địa điểm độc lập recommendation, không cần user_id, không đọc lịch sử, không chèn khám phá hoặc tự nới bộ lọc. Dữ liệu lấy từ catalog SQLite được nạp qua API embedding/place(s) hoặc places/batch; các point chỉ tồn tại trong Qdrant mà chưa vào catalog này không được tìm bởi endpoint mới.

## Request

```json
{
  "query": "Tìm khách sạn ở Đà Nẵng có hồ bơi gần biển dưới 1 triệu",
  "filters": {},
  "infer_filters": true,
  "limit": 10,
  "offset": 0
}
```

Parser nhận diện điều kiện theo luật tiếng Việt có dấu/không dấu. Thành phố lấy từ danh mục đang có, chỉ khi đi sau “ở”, “tại”, “thành phố” để hạn chế nhầm tên khách sạn. Nhận diện một loại Hotel/Restaurant/Attraction và các tiện ích cơ bản bể bơi/hồ bơi, spa, Wi-Fi, đỗ xe, bữa sáng. Không phải LLM hoặc bộ hiểu mọi câu tiếng Việt. Nếu có nhiều loại/thành phố hoặc tiện ích dùng “hoặc”, API báo mơ hồ thay vì đoán một bộ lọc AND. “Ưu tiên”, “không cần”, “không bắt buộc” ngay trước tiện ích được giữ như nội dung thay vì yêu cầu bắt buộc.

Điều kiện backend gửi trong `filters` được ưu tiên hơn nhận diện trong câu. Có thể đặt `infer_filters:false` để chỉ dùng bộ lọc explicit. Giá trị null hoặc danh sách rỗng explicit xóa điều kiện nhận diện tương ứng.

Các filters:

```json
{
  "city": "Đà Nẵng",
  "place_type": "Hotel",
  "category": "Khách sạn",
  "amenities": ["Hồ bơi", "Spa"],
  "excluded_amenities": [],
  "budget": "nhãn ngân sách trong dữ liệu",
  "family_friendly": true,
  "min_rating": 4.0,
  "latitude": 16.05,
  "longitude": 108.2,
  "radius_km": 10,
  "exclude_place_ids": []
}
```

Đây là ví dụ các trường hỗ trợ, không phải bộ lọc nên gửi đầy đủ cho mọi request. Không gửi những điều kiện không cần. Amenities bắt buộc phải khớp tất cả; alias hồ bơi/bể bơi tương đương, “Bể bơi ngoài trời” cũng khớp. Category và budget là nhãn chính xác, không phân biệt dấu/hoa thường; không tự đổi “rẻ” thành một mức giá tiền. Giá trị thiếu không đạt điều kiện dương bắt buộc. Tọa độ tham chiếu phải gửi cặp; radius cần cả cặp tọa độ. Không suy ra vị trí user từ IP hoặc “gần tôi”.

Excluded amenities chỉ loại nơi có tiện ích đã ghi nhận; nơi không có bất kỳ metadata tiện ích cũng bị loại vì chưa biết. Một danh sách tiện ích khác vẫn chưa chứng minh địa điểm không có bể bơi: response luôn nêu giới hạn này. Chưa có thuộc tính biểu diễn sự vắng mặt đã được xác minh. Phủ định khác như “không ồn” không được đảm bảo bởi bộ lọc luật.

## Response

- `request_id`: ID của lần tìm, hiện không lưu search log hoặc dùng ID này cho recommendation interactions/impressions.
- `query`, `parser`: câu gốc và phiên bản parser.
- `inferred_filters`: điều kiện nhận diện trước ưu tiên explicit.
- `applied_filters`: bộ lọc thực sự áp dụng.
- `unsupported_requirements`: yêu cầu chưa kiểm chứng được, ví dụ giá <1 triệu, khoảng cách đến biển, đang mở cửa.
- `warnings`: mơ hồ, ghi đè điều kiện, vector cũ/thiếu, không có kết quả.
- `total`, `offset`, `limit`, `results`: tổng kết quả sau lọc/ngưỡng và trang hiện tại.
- Mỗi result có place_id, tên, loại, thành phố, image_url, khoảng cách nếu tính được, semantic_score (cosine), keyword_score (BM25), score (RRF), exact_name_match và lý do.

`min_similarity` tùy chọn (-1..1) lọc cosine tối thiểu; vector cũ/thiếu không thể đạt ngưỡng này. Không có ngưỡng được hiệu chỉnh mặc định, nên khi không đặt ngưỡng, nội dung ít liên quan vẫn có thể xuất hiện ở cuối danh sách. Các điểm không phải xác suất hài lòng. Truy vấn nguyên tên địa điểm được ưu tiên khớp chính xác sau khi vẫn phải qua tất cả bộ lọc.

## Cách tính

1. Lấy bản ghi active, suy ra và áp dụng bộ lọc.
2. Encode query bằng BGE hiện có. Chỉ dùng vector cùng model và content_hash hợp lệ.
3. Tính cosine chính xác bằng numpy trên vector lưu SQLite. Endpoint này hiện không gọi Qdrant ANN; phù hợp catalog vài nghìn nơi và vẫn hoạt động khi Qdrant tạm lỗi. Qdrant tiếp tục được ghi qua API nạp dữ liệu và dùng bởi các luồng khác.
4. BM25 trên tên (lặp 3 lần), danh mục, tags, tiện ích, mô tả và thành phố, có chuẩn hóa dấu. Đây là tokenizer từ đơn đơn giản, chưa có bộ tách từ tiếng Việt chuyên dụng. k1=1.2, b=0.75.
5. Trộn theo thứ hạng RRF: tổng `1/(60+rank)` của hai nguồn; không cộng trực tiếp thang cosine và BM25. Exact whole-name đứng trước, sau đó RRF; tie theo place_id để phân trang ổn định khi catalog không đổi.

Vector cũ/thiếu chỉ tham gia BM25 và được cảnh báo. Không dùng CLIP text encoder cho search địa điểm. Không có LLM sinh câu trả lời hoặc cross-encoder reranker trong phiên bản này. Những câu phức tạp cần frontend/backend gửi bộ lọc rõ ràng hoặc bổ sung parser tốt hơn sau khi có bộ query đánh giá.

Khi catalog/lưu lượng lớn cần lexical index và vector retrieval phía server thay vì đọc toàn bộ catalog. Chất lượng semantic/BM25/RRF và luật nhận diện cần đánh giá trên query tiếng Việt thực tế, không được suy từ unit tests.

## Kết nối backend

Gửi `Content-Type: application/json` và `X-API-Key` khi cấu hình `RECOMMENDATION_API_KEY`. Lỗi payload 422, thiếu key 401. Không cần cài thêm dependency hoặc tạo collection mới. Khi chạy Compose có bind mount/reload hiện tại, code mới được nạp tự động; nếu chạy image đóng gói, rebuild/restart ứng dụng.

Search response khác recommendation response: chưa lưu vào bảng impressions recommendation. Backend có thể ghi analytics riêng; không gửi request_id search vào API interactions/impressions hiện đang kiểm tra request_id recommendation. Nếu tương tác xuất phát từ search, bỏ request_id hoặc lưu mapping ở backend.

Tài liệu thuật toán tham khảo: [BM25 parameters](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity), [rank fusion](https://qdrant.tech/documentation/search/hybrid-queries/).
