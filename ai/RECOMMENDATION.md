# Recommendation v2

Hệ thống đề xuất theo nội dung, chất lượng và ngữ cảnh; thêm ItemKNN khi có dữ liệu hỗ trợ. Giữ API cũ, không thêm endpoint cho từng bước nội bộ.

Các phần chính: `place_document.py` tạo văn bản factual; `profiles.py` tạo nhóm sở thích;
`eligibility.py` chọn loại bản ghi phù hợp; `ranking.py` tính điểm;
`hybrid_service.py` điều phối; `interaction_weights.py` tổng hợp hành vi;
`training.py` và `evaluation.py` phục vụ đánh giá/huấn luyện offline.

## Dữ liệu và collection

- Collection chính: `documents_bge_m3`, named vector `dense`, BGE-M3 1.024 chiều, Cosine.
- `tourism_places_v1` giữ nguyên để đối chiếu, không còn là collection runtime sau chuyển đổi.
- `tourism_images_clip_v1` dành riêng cho CLIP; không tham gia xếp hạng Recommendation v2.
- Sparse trong collection chính được giữ theo thiết kế nhưng chưa được sinh/truy vấn bởi Recommendation. Không gọi đây là dense+sparse retrieval.
- SQLite lưu bản ghi đầy đủ, reviews, sở thích, hành vi và xác nhận hiển thị.
- Qdrant lưu vector và các thuộc tính lọc/giải thích: place_id dạng chuỗi keyword, name, city, place_type, categories, amenities, tags, rating, review_count, budget, family_friendly, active, location và model.
- Chỉ mục payload place_id được sửa về keyword. Không chuyển mã chuỗi sang integer.

## Vector địa điểm

`place_document.py` ghép tên, loại, thành phố, danh mục, tiện ích, tags, phong cách và mô tả do backend cung cấp. Không dùng review_summary hoặc reviews để suy ra tiện ích/sở thích. Không thêm giá, tọa độ hoặc thông tin thiếu.

Model dữ liệu vector có hậu tố `facts-v2`. Vector từ pipeline cũ không được dùng làm lịch sử hay tính điểm nội dung khi chưa tạo lại. Hash nội dung tránh embedding lại khi chỉ đổi rating hoặc metadata không thuộc văn bản.

API từ chối ký tự mất `�`, surrogate hỏng và một số mẫu mojibake phổ biến trong các trường văn bản factual trước khi gọi model. Đây không phải kiểm chứng mọi chính tả hoặc tính đúng thực tế của nhãn dữ liệu. Query Recommendation là ưu tiên ngữ nghĩa; điều kiện bắt buộc cần gửi trong các trường lọc, không tự biến phủ định trong query thành bộ lọc.

Reviews giữ riêng để kiểm tra và phát triển tín hiệu trải nghiệm sau này. API review không làm thay đổi vector địa điểm. Cờ `use_for_embedding` chỉ lưu trạng thái tuyển chọn cho các pipeline review tương lai; không có nghĩa review được ghép vào vector chính.

Rating và review_count dùng để xếp hạng là số tổng hợp do backend gửi trong bản ghi địa điểm. Khi tổng hợp thay đổi, backend gửi lại địa điểm đầy đủ; vector được tái sử dụng nếu văn bản không đổi. Không tự tính rating của toàn bộ địa điểm từ một mẫu review được nhập.

## Hồ sơ người dùng

`profiles.py`:

1. Embedding từng sở thích khai báo, không ghép tất cả thành một câu.
2. Lấy tối đa 100 địa điểm có tín hiệu tích cực, cùng loại nếu có bộ lọc.
3. Gom các vector có cosine >=0,92; giữ tối đa 3 nhóm mặc định. Nhóm ít hỗ trợ bị giảm ưu tiên so với nhóm mạnh.
4. Nếu có sở thích khai báo, tổng phần lịch sử tăng theo độ mạnh tương tác và giới hạn 60%; không để một lần nhấn thay toàn bộ hồ sơ.
5. Nếu chỉ có lịch sử, độ tin cậy là mass/(mass+5), làm giảm trọng số nội dung khi tín hiệu yếu.
6. Nếu có query, điểm nội dung kết hợp 70% query và 30% nhóm phù hợp nhất. Query được lấy ứng viên riêng.

Các ngưỡng trên là heuristic khởi đầu, cần đánh giá bằng dữ liệu hành vi, không phải các hệ số đã được chứng minh tối ưu.

## Truy xuất và xếp hạng

- Mặc định tách các bản ghi Attraction chỉ có danh mục dịch vụ rõ ràng (đại lý du lịch, nhà điều hành, vé máy bay, vận tải, văn phòng...) khỏi gợi ý điểm đến. Không suy từ tên, không đổi nhãn nguồn, không loại địa điểm có danh mục hỗn hợp hay chưa biết. Dùng `include_service_places=true` hoặc `category` rõ ràng nếu muốn tìm dịch vụ. `diagnostics.service_only_excluded` cho biết số bản ghi bị tách.
- Kiểm tra các điều kiện bắt buộc trước và sau truy xuất; trường thiếu không đáp ứng một điều kiện bắt buộc.
- Chia ngân sách tối đa 500 ứng viên dense giữa các nhóm/query, hợp nhất với 100 ứng viên chất lượng, 100 gần nhất khi cần và 100 từ cộng đồng.
- Tính cosine chỉ trong tập ứng viên; khi Qdrant lỗi/rỗng dùng exact fallback có kiểm soát. Metadata vẫn được quét từ SQLite, nên bản này dành cho catalog nhỏ/vừa, chưa phải kiến trúc hàng triệu địa điểm.
- Chất lượng Bayesian dùng mức tham chiếu theo thành phố và loại: `(n*rating + m*mean)/(n+m)`, m mặc định 50; sau đó đổi thang 1–5 về 0–1.
- Trọng số cấu hình: nội dung 0,6; chất lượng 0,2; khoảng cách 0,1; cộng đồng 0,1. Nội dung nhân độ tin cậy hồ sơ. Chỉ chuẩn hóa trên những thành phần có dữ liệu.
- Khoảng cách: `2^(-km/10)` mặc định. Thiếu vị trí thì bỏ thành phần này.
- Giảm điểm tối đa 0,05 khi địa điểm được xác nhận hiển thị lặp lại trong 14 ngày; không phạt chỉ vì server đã trả response.
- Chọn đa dạng bằng cosine giữa các kết quả, dành khoảng 10% slot khám phá khi bật và đủ ứng viên. Mọi slot vẫn tuân thủ điều kiện bắt buộc.
- Mỗi danh sách chỉ hiển thị một bản ghi cho cùng tên chuẩn hóa–thành phố–loại, kể cả slot khám phá. Đây là quy tắc đa dạng hiển thị; không gộp/xóa ID nguồn, có thể trả ít hơn limit khi không còn đủ tên khác nhau.
- Các bản ghi có cùng khóa hiển thị cũng chia sẻ mức giảm lặp; đổi sang ID trùng tên không né được mức giảm này. Sự kiện gốc vẫn giữ nguyên place_id.
- Điểm trả về là điểm xếp hạng, không phải xác suất thích. `effective_weights` và `diagnostics` cho phép kiểm tra cách chấm.

## Hành vi và ItemKNN

Các API hiện có:

| API (tiền tố /api/v1) | Vai trò |
|---|---|
| POST /recommendations | Trả đề xuất và request_id |
| PUT /users/{id}/preferences | Lưu sở thích khai báo |
| POST /impressions | Xác nhận những địa điểm thực sự được hiển thị |
| POST /interactions | Ghi click/view/favorite/booking/rating/dismiss/unfavorite |
| POST /embeddings/place hoặc /places/batch | Cập nhật thông tin địa điểm và vector |
| POST /reviews/batch | Lưu raw/normalized review và cờ tuyển chọn |
| GET /recommendation/status | Collection, phiên bản, pending và cấu hình |
| POST /recommendation/reindex?limit=10 | Sửa các bản ghi vector chưa đồng bộ/khác phiên bản |

Giữ event_id và occurred_at khi retry. Gửi cùng request_id để kiểm tra hành vi có thuộc danh sách và người dùng hay không. View dưới 10 giây không tạo tín hiệu tích cực; hành vi lặp bị giới hạn và suy giảm theo thời gian. Dismiss hoặc rating <=2 loại địa điểm đó khỏi đề xuất cho người dùng.

ItemKNN online yêu cầu ít nhất 3 người dùng tích cực; liên hệ item-item yêu cầu tối thiểu 2 người đồng tương tác và được giảm theo độ hỗ trợ. Artifact offline có thể dùng nếu dữ liệu huấn luyện đủ hỗ trợ. Chưa có tự động học trọng số ranker hoặc lịch huấn luyện định kỳ.

## Import Excel sạch

Importer trim tên cột, đọc cột `Dùng cho embedding` thành `use_for_embedding`; TRUE phải có `Nội dung chuẩn hóa (Embedding)`. Không tự lấy raw text làm normalized_text. Giữ tất cả review để truy vết, bao gồm 7 review không được chọn trong bản sạch đã kiểm tra. `cleaning_version` ghi phiên bản quy trình.

```
python scripts/index_places.py "path/to/du_lieu_du_lich_lam_sach_kiem_chung.xlsx"
python scripts/index_places.py "path/to/du_lieu_du_lich_lam_sach_kiem_chung.xlsx" --send --batch-size 10
```

## Kiểm tra và đánh giá

```
python -m unittest discover -s tests -q
```

Kiểm thử bao gồm nhiều sở thích độc lập, mức độ tin cậy, query, bộ lọc, review không gây thay đổi vector, cờ importer, lặp hiển thị, ItemKNN đủ hỗ trợ và Qdrant fallback.

`scripts/evaluate.py` đánh giá snapshot theo thời gian bằng Recall/NDCG/Precision/HitRate cho ba phương án: chất lượng, nội dung–chất lượng–ngữ cảnh, và hybrid thêm ItemKNN. Tắt trọng số cộng đồng cũng tắt nguồn ứng viên cộng đồng để ablation không dùng ngầm tín hiệu này. Snapshot phải không chứa thông tin tương lai và có vector đúng phiên bản, đủ hash. Chưa có ground truth và hành vi đủ lớn để công bố cải thiện độ chính xác thực tế. Cần thu thập xác nhận hiển thị và hành vi trước khi tune/đánh giá trọng số.
