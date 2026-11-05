# Recommendation hiện tại: Content-based + Bayesian rating

Đây là chế độ mặc định (`REC_MODE=content_rating`). Compose cố định chế độ này cho giai đoạn hiện tại. Không sử dụng lịch sử hành vi, ItemKNN, artifact huấn luyện, điểm khoảng cách, giảm lặp hiển thị, diversity reranking hoặc khám phá ngẫu nhiên. Những phần hybrid cũ được giữ riêng để phát triển sau; không chạy trong luồng mặc định.

## Dữ liệu và embedding

- Dữ liệu địa điểm, rating và review_count đã có trong catalog; không sinh thêm dữ liệu giả.
- `place_document.py` ghép tên, loại, thành phố, danh mục, tiện ích, tags, phong cách và mô tả thành văn bản `facts-v2`.
- BGE-M3 tạo vector 1.024 chiều chuẩn hóa. Qdrant: `documents_bge_m3`, named vector `dense`.
- Rating, review_count và tọa độ không ghép vào embedding. Review văn bản và cờ `use_for_embedding` không ảnh hưởng vector hoặc thứ hạng.
- Đổi rating/review_count chỉ cập nhật metadata; không embedding lại nếu nội dung và model không đổi.

## Đầu vào

```json
{
  "user_id": "demo-user",
  "city": "Đà Nẵng",
  "place_type": "Hotel",
  "preferences": ["biển", "nghỉ dưỡng"],
  "query": "Muốn tìm nơi yên tĩnh",
  "limit": 10
}
```

`POST /api/v1/recommendations` vẫn dùng API key nội bộ. User ID giữ tính tương thích với API và các phần lịch trình; không tạo tín hiệu lịch sử. Có thể truyền preferences trực tiếp hoặc dùng sở thích khai báo đã lưu. `preferences: []` chủ động xóa ảnh hưởng của sở thích đã lưu trong lần gọi đó; bỏ trường này thì đọc sở thích khai báo đã lưu. Demo luôn gửi danh sách, kể cả rỗng.

Query là ưu tiên ngữ nghĩa. Các điều kiện bắt buộc phải truyền riêng: city, place_type, category, budget, family_friendly, latitude/longitude/radius_km và exclude_place_ids. Không tự chuyển câu phủ định hoặc giá tiền thành bộ lọc. Dữ liệu thiếu không đáp ứng điều kiện bắt buộc. Mặc định không gợi ý Attraction chỉ có danh mục dịch vụ thuần, trừ khi yêu cầu rõ category hoặc include_service_places.

`exclude_seen` và `exploration` giữ cho tương thích nhưng không áp dụng trong chế độ hiện tại; nếu bật, response có warnings. Các endpoint ghi tương tác cũ không tác động tới thứ hạng này.

## Luồng thuật toán

1. Embedding từng sở thích khai báo; gom các vector gần nhau theo ngưỡng cosine 0,92, giữ tối đa 3 nhóm. Không dùng lịch sử người dùng.
2. Embedding query riêng. Nội dung phù hợp với nhóm tốt nhất được điều chỉnh theo trọng số hỗ trợ nhóm. Có cả query và nhóm: 70% query + 30% nhóm; chỉ có một nguồn thì dùng nguồn đó.
3. Lọc các điều kiện bắt buộc trước khi xếp hạng.
4. Truy xuất ứng viên qua vector query và các nhóm, chia ngân sách khoảng 500 kết quả giữa các nguồn. Hợp nhất thêm 100 ứng viên chất lượng và các mục chờ đồng bộ. Số ứng viên sau hợp nhất có thể lớn hơn 500.
5. Nếu Qdrant lỗi hoặc không có ứng viên hợp lệ, tính nội dung chính xác trên các vector catalog hiện có; không tự nới bộ lọc.
6. Tính điểm nội dung và Bayesian rating theo công thức dưới đây, sắp điểm giảm dần. Hòa điểm thì theo place_id để ổn định.
7. Hiển thị tối đa một bản ghi có cùng tên chuẩn hóa, thành phố và loại. Quy tắc này không gộp hoặc xóa dữ liệu nguồn. Có thể trả ít hơn limit nếu không đủ tên khác nhau.

## Công thức điểm

`C = (cosine_nội_dung + 1) / 2`

`Q = ((n × r + m × μ) / (n + m) - 1) / 4`

- r: rating của địa điểm trên thang 1–5.
- n: review_count của địa điểm; bằng 0 nếu thiếu rating.
- μ: trung bình rating có trọng số review_count của các địa điểm đang hoạt động, phù hợp chính sách loại địa điểm, trong cùng thành phố và loại. Chưa có nhóm hợp lệ thì dùng mức tham chiếu 3,5.
- m: độ mạnh tham chiếu, mặc định 50 (`REC_PRIOR_STRENGTH`).
- Chưa đủ rating/lượt đánh giá thì dùng mức tham chiếu và giải thích rõ. Đây không phải rating đã được xác minh cho địa điểm đó.

`score = 0,75 × C + 0,25 × Q` theo cấu hình mặc định. Các giá trị gốc 0,6 và 0,2 được chuẩn hóa trên hai nguồn, không thêm trọng số cộng đồng hay khoảng cách. Đây là heuristic chưa được hiệu chỉnh bằng ground truth; score không phải xác suất yêu thích.

Không có query hoặc sở thích: dùng `score = Q`, strategy `rating_fallback`. Ứng viên thiếu vector đúng phiên bản cũng chỉ dùng Q và được báo trong warnings. Trọng số thực tế từng mục được trả trong effective_weights.

Tọa độ vẫn phục vụ lọc bán kính và hiển thị distance_km; distance_score luôn null, không cộng/trừ điểm khoảng cách.

## Kết quả và kiểm tra

- strategy: content_rating hoặc rating_fallback.
- model_version bắt đầu content-rating-v1-; phiên bản vector vẫn facts-v2 nên không cần re-embedding toàn bộ catalog.
- Mỗi mục có content_score (cosine, -1..1), quality_score (0..1), score, rating, review_count, effective_weights và reasons.
- collaborative_score=null, repeat_penalty=0, is_exploration=false.
- diagnostics xác nhận history_used=false, collaborative_active=false và distance_scoring=false.
- Lưu kết quả request để đọc lại không đồng nghĩa ghi nhận hành vi hoặc hiển thị; không dùng những bản ghi này để chấm điểm.
- Trip Planner dùng được cùng ranker. Search BGE + BM25 là luồng riêng và không đổi.

```powershell
python -m unittest discover -s tests -p test_content_rating.py -q
python -m unittest discover -s tests -q
```

Test dùng embedding giả, Qdrant in-memory và database tạm. Bao gồm tính điểm, cold start, vô hiệu ảnh hưởng hành vi, lọc bắt buộc, fallback, cập nhật rating không re-embedding, kết quả xác định và tích hợp Trip Planner. Test đúng công thức không chứng minh hiệu quả khuyến nghị thực tế; cần bộ nhãn đánh giá riêng để tune trọng số.
