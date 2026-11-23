# So sánh các phương pháp Recommendation

## Các phương án

| Phương án | Đặc trưng | Dùng hành vi? | Rating? | MMR? |
| --- | --- | --- | --- | --- |
| `rating_only` | Baseline chất lượng Bayesian, chỉ dùng trong runner đánh giá | Không | Có | Không |
| `tfidf` | TF-IDF word 1–2 gram, cosine, profile sở thích khai báo | Không | Không | Không |
| `semantic` | BGE-M3, cosine, cùng chính sách tổng hợp sở thích | Không | Không | Không |
| `content_rating` | BGE-M3 + Bayesian Rating, mặc định 75%/25% | Không | Có | Không |
| `personalized_mmr` | Sở thích + vector lịch sử, alpha 0.5; Rating; MMR lambda 0.7 | Có nếu được cung cấp | Có | Có |

Baseline TF-IDF/Semantic chạy qua cùng `POST /api/v1/recommendations`, đổi `mode`. Không thay mặc định `auto` của sản phẩm trong lúc thực nghiệm. Chưa có sở thích biểu diễn được thì baseline thuần trả rỗng/cảnh báo, không tự biến thành Rating để làm đẹp chỉ số.

## Bộ dữ liệu dùng chung

- Nguồn địa điểm thật: snapshot catalog AI; chỉ các ID có trong corpus gốc của bộ test tìm kiếm, bỏ địa điểm dịch vụ không phù hợp. Giữ nguyên rating và review_count thật; không bịa rating.
- Nguồn nhãn: nhãn quy tắc từ catalog của bộ test có sẵn (`sources/place-search-v1`). Đây là **silver/nháp**, cần người duyệt. Không gán nhãn theo thứ hạng do bất kỳ model nào trả về.
- Các câu mô tả nhu cầu được chuyển thành sở thích của hồ sơ mô phỏng. Không dùng bài tìm tên riêng làm bài đánh giá Recommendation.
- Chia ID địa điểm bằng SHA256 cố định: khoảng 1/3 chỉ dùng làm lịch sử, 2/3 chỉ để đề xuất/chấm điểm. Với mỗi chủ đề, tối đa 3 địa điểm tích cực ở phần lịch sử được mô phỏng thành thao tác lưu. Chỉ giữ chủ đề có positive trong cả hai phần; ghi rõ chủ đề bị bỏ trong manifest.
- Mỗi chủ đề có một hồ sơ **cold** (không sự kiện) và một hồ sơ **warm** (có sự kiện). Hai hồ sơ dùng cùng sở thích khai báo, cùng bộ lọc, cùng tập ứng viên và nhãn đánh giá. Nhãn ở phần chấm điểm không được dùng để chọn địa điểm lịch sử.
- Dữ liệu được đóng băng thành `catalog.jsonl`, `profiles.jsonl`, `judgments.csv`, `manifest.json` trong `datasets/recommendation-v1`; kiểm tra hash khi chạy lại. Không tự ghi đè dữ liệu nếu catalog đổi.
- Hành vi mô phỏng chỉ ghi vào database tạm của runner, **không ghi vào database sản phẩm**. BGE dùng vector hợp lệ sẵn có; nếu phát hiện vector không khớp cùng văn bản/model, chỉ nhúng lại trong database tạm và ghi số lượng trong báo cáo.

Đây là phép kiểm tra offline có kiểm soát, chưa phải đánh giá người dùng thật hay dự báo hành vi tương lai. Dùng cùng chủ đề cho sở thích và lịch sử giúp so sánh nhất quán nhưng không mô phỏng đầy đủ sở thích thay đổi/mâu thuẫn. TF-IDF có thể được lợi từ nhãn quy tắc thiên về từ khóa. Không kết luận một phương pháp luôn tốt nhất từ bộ dữ liệu này.

## Chỉ số và giao thức

- K = 5, 10, 20. Precision@K = số positive / K; Recall@K = số positive tìm được / toàn bộ positive ở tập chấm điểm.
- MRR@K: trung bình nghịch đảo vị trí positive đầu tiên; relevant khi grade ≥2.
- nDCG@K dùng gain `2^grade - 1`; toàn bộ ứng viên trong scope có nhãn. Báo cáo judged coverage để kiểm chứng.
- ILD@K: khoảng cách trung bình giữa cặp địa điểm trong cùng một không gian **BGE chuẩn hóa dùng chung** cho mọi phương pháp, `(1-cosine)/2`, trong [0,1]. Không so ILD TF-IDF với ILD BGE ở hai không gian khác nhau.
- Catalog coverage@K = số địa điểm khác nhau được đề xuất / hợp các địa điểm ứng viên của các hồ sơ đang chấm.
- Tính riêng cold/warm. Ba lần gọi mỗi hồ sơ kiểm tra ổn định và đo latency; không coi là ba user độc lập. Không tự chỉnh alpha/lambda/trọng số theo tập test.
- Cùng full candidate pool, bộ lọc, khử trùng tên và loại điểm lịch sử cho mọi phương án; không để ANN khác nhau làm nhiễu phép so sánh xếp hạng. Luân phiên danh sách được tắt (`refresh_variety:false`).
- Latency đo trong process, bao gồm đọc dữ liệu, tạo vector sở thích, tính điểm và định dạng; loại model startup, fit TF-IDF ở warmup, HTTP/network và ghi log. Không so trực tiếp với latency HTTP của bộ tìm kiếm trước đây.
- RAM đo process mỗi 50 ms, process dùng chung BGE/TF-IDF và bộ đánh giá; không phải RAM riêng từng phương pháp. Các encoder chạy CPU, không cấp phát VRAM trong phép thử này. Không dùng chênh lệch RSS này để kết luận footprint độc lập.
- Báo cáo thêm paired bootstrap 95% CI (2.000 lần, seed 42) theo hồ sơ cho chênh lệch nDCG/Recall/ILD @10. Đây là phân tích thăm dò, chưa điều chỉnh multiple comparisons.

## Chạy lại

Chạy trong môi trường Linux/container có các dependency của `ai/`, cache model BGE và file **snapshot SQLite nhất quán** (dùng SQLite backup, không copy thẳng file đang ghi WAL):

Image ứng dụng thông thường không đóng gói bộ dữ liệu đánh giá; khi chạy bằng Docker, mount toàn thư mục `ai/` vào thư mục làm việc của container, cùng snapshot chỉ đọc và volume cache model. Script không dùng catalog live làm nơi ghi dữ liệu thử nghiệm.

```bash
python scripts/evaluate_recommendation.py --catalog-db /path/catalog-snapshot.sqlite3 --allow-draft --build-dataset
```

Chỉ dùng `--build-dataset` lần đầu, hoặc chọn đường dẫn/version mới. Đã có dữ liệu thì:

```bash
python scripts/evaluate_recommendation.py --catalog-db /path/catalog-snapshot.sqlite3 --allow-draft --repeats 3
python scripts/summarize_recommendation.py evaluation/results/recommendation-v1
```

`--split validation` / `--split test` hỗ trợ tách kết quả theo split có sẵn. Bản đo ban đầu dùng toàn bộ (`all`) với tham số cố định, chưa tối ưu hyperparameter. Không dùng nhãn nháp cho kết luận cuối của báo cáo trước khi duyệt.

Kết quả ở `results/recommendation-v1`: `summary.json`, `metrics.csv`, `runs.jsonl`, `comparison.md`, `paired-comparisons.json`. Chạy kiểm thử: `python -m unittest discover -s tests -q`.

## Kết quả thực đo ban đầu và cách chọn

Đã chạy 44 hồ sơ × 3 lượt × 5 phương pháp = 660 lượt chấm, trên 2.130 địa điểm. Bảng dưới lấy **22 hồ sơ warm**, K=10; số đo latency là trung bình cả hai nhóm, đơn vị ms trong process:

| Phương pháp | Precision@10 | Recall@10 | MRR@10 | nDCG@10 | ILD@10 | Latency TB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bayesian Rating | 0.3000 | 0.0858 | 0.5295 | 0.3137 | 0.1824 | 130 |
| TF-IDF | 0.8045 | 0.2695 | 0.9470 | 0.8384 | 0.1450 | 226 |
| Semantic BGE-M3 | 0.8636 | 0.2896 | 0.9697 | 0.8887 | 0.1360 | 465 |
| BGE + Rating | 0.8136 | 0.2506 | 0.9773 | 0.8478 | 0.1465 | 492 |
| Hồ sơ hành vi + Rating + MMR | 0.7273 | 0.2286 | 1.0000 | 0.7740 | 0.1594 | 690 |

**Nếu mục tiêu chính là mức phù hợp theo nhãn hiện tại**, Semantic BGE-M3 có Recall và nDCG trung bình cao nhất, là ứng viên nền phù hợp để chọn tạm thời. TF-IDF là đối chứng nhẹ, latency thấp hơn. Chênh lệch nDCG BGE–TF-IDF là +0.0503 nhưng CI 95% [-0.0215, 0.1351] còn chứa 0: chưa đủ bằng chứng thống kê để khẳng định BGE luôn vượt TF-IDF.

**Không kết luận Personalized + MMR là tốt nhất chỉ vì phức tạp hơn**: MRR@10 đạt 1.0 và ILD tăng từ 0.1465 lên 0.1594 so với BGE + Rating, nhưng nDCG giảm 0.0737 (CI [-0.1226, -0.0293]) trong nhóm warm. Nhãn hiện đánh giá nội dung, chưa đo sự hài lòng/chất lượng trải nghiệm thực, và nhánh này đồng thời đổi hồ sơ lẫn đa dạng hóa nên không quy toàn bộ chênh lệch cho riêng MMR.

Giữ nguyên `auto` đã tích hợp; các phương án mới cho phép nhóm đối chứng và trình bày. Muốn chọn phương án cuối cho sản phẩm cần duyệt nhãn thủ công, chọn mục tiêu relevance/quality/diversity, khảo sát alpha/lambda/trọng số trên **validation**, rồi xác nhận trên **test** và hành vi thật. Không tự điều chỉnh theo các số test trên để làm đẹp kết quả.
