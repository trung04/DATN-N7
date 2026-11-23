# AI service in DATN-N7

## Luồng đang hoàn thiện: chatbot trong AI demo độc lập

Mở **http://localhost:9002/demo**, nhập service key trong **Cài đặt kết nối**, chọn tab **Chat & lịch trình**. Chỉ AI service được dùng cho luồng này; không cần đăng nhập frontend/backend.

1. Nhắn “Lập lịch Đà Nẵng 3 ngày, thích biển và ẩm thực.”
2. Trả lời ngày khởi hành khi trợ lý hỏi. Gemini chỉ hiểu yêu cầu và giải thích; địa điểm, thời gian và tuyến do công cụ/thuật toán tính từ dữ liệu có sẵn.
3. Xem bản xem trước theo ngày, thời gian tham quan/di chuyển, cảnh báo dữ liệu thiếu và giới hạn 480 phút/ngày.
4. Nhắn “Ngày 2 bỏ [tên], thay bằng quán cà phê”, hoặc “Ngày 1 thêm [tên địa điểm chính xác]”. Nếu không xác định duy nhất ngày/địa điểm, trợ lý hỏi lại.
5. Có thể **Bỏ điểm này**, **Lên trước**, tìm địa điểm để thêm vào từng ngày, **Tối ưu lại**, hoặc **Xuất JSON**. Thêm điểm tăng mục tiêu số điểm riêng ngày đó; không tự tăng giới hạn thời gian.
6. Bấm **Lưu lịch demo**. Chỉ lúc này lịch được lưu trong AI service. **Lịch demo đã lưu** mở lại lịch theo User ID thử nghiệm, hỗ trợ cập nhật tên/nội dung và xóa. Tải lại trang không mất các lịch đã lưu.

ORS chạy trực tiếp trong AI khi `TRIP_ORS_MODE=direct`. Endpoint HeiGIT là `/openrouteservice/v2/matrix/{profile}`; profile mặc định `driving-car`. Ma trận có hướng, đơn vị gốc giây/mét, chia block 25×25, retry hữu hạn, không thay chặng không đi được bằng 0. Cache SQLite riêng trong volume AI là cấu hình demo; phương án PostgreSQL ở backend dành cho người tích hợp sau. Không tự giả lập kết quả thành công khi ORS/Gemini lỗi. Tọa độ lấy từ catalog AI có thật; nguồn dữ liệu/giờ mở cửa thiếu vẫn được cảnh báo.

Từ thư mục gốc, sau khi đã có root `.env` chứa service key, Gemini và ORS:

```powershell
docker compose -f compose.yml -f ai/compose.demo.yml build ai
docker compose -f compose.yml -f ai/compose.demo.yml up -d --no-deps ai
```

Nếu chưa chạy Qdrant thì khởi động riêng `docker compose up -d qdrant` trước. Hai lệnh trên không dựng lại backend/frontend. Cổng `9002` là cấu hình máy đang dùng; đổi bằng `AI_PORT` trong root `.env`.

Chạy native: sao chép `ai/.env.example` sang `ai/.env`, điền khóa và URL Qdrant, chạy `uvicorn app.main:app --host 127.0.0.1 --port 9002` trong `ai/`. Không commit các file `.env`.

API của demo vẫn yêu cầu `X-API-Key`:

| API | Tác dụng |
| --- | --- |
| `POST /api/v1/chat` với `preview_only=true` | Hội thoại tạo/chỉnh bản xem trước |
| `POST /api/v1/trips/preview` | Tạo preview từ yêu cầu có cấu trúc |
| `PATCH /api/v1/trips/previews/:id/days/:day` | Thêm/bỏ/sắp thứ tự một ngày, yêu cầu `expected_version` |
| `POST /api/v1/trips/previews/:id/reoptimize` | Tính lại preview, giữ các điểm đã loại trừ |
| `POST /api/v1/demo/trips` | Lưu rõ ràng; gửi `user_id`, `draft_id`, `expected_draft_version`, `name` |
| `GET /api/v1/demo/trips?user_id=...` | Liệt kê lịch đã lưu trong AI demo |
| `GET/DELETE /api/v1/demo/trips/:id` | Đọc/xóa theo User ID; xóa cần `expected_version` |
| `POST /api/v1/demo/trips/:id/preview` | Mở lịch demo thành preview để sửa, không thay lịch đã lưu |

User ID trong demo là danh tính thử nghiệm dùng cùng service key, không phải hệ thống đăng nhập đa người dùng của sản phẩm. Lịch demo được lưu riêng trong `demo_saved_trips`, không ghi database backend. Preview hết hạn sau 24 giờ; lịch demo đã lưu không bị xóa theo TTL preview. Giữ `expected_version` để tránh ghi đè thay đổi từ tab khác.

## Tham khảo cho người tích hợp backend/frontend sau

Đã đồng bộ nền repository với `origin/dev` tại commit `a8a137e`. Sau khi được cho phép sửa riêng phần chatbot và đăng nhập liên quan, giao diện chính gọi backend `/api/v1/trip-planner/*` bằng phiên đăng nhập chung; backend gọi AI bằng service key. Bản stash dự phòng trước khi hợp nhất là `f9fef734c00b58c4ca0a0304c9ad0406172a4b75`.

Các endpoint dưới đây nằm **trên AI service**, chưa phải endpoint được NestJS proxy. Chúng yêu cầu `X-API-Key` bằng `RECOMMENDATION_API_KEY`. Backend phải xác thực phiên và lấy `userId` từ phiên rồi mới gọi AI; không chuyển khóa AI xuống trình duyệt và không tin `userId` do trình duyệt tự gửi.

| API AI | Chức năng |
| --- | --- |
| `POST /api/v1/ai/search` | Semantic search; cùng request/response với `/api/v1/search/places` |
| `POST /api/v1/ai/recommendations` | Adapter trả mảng `id/type/name/city/price/tags/description/score/reason/image` gần với hợp đồng frontend hiện tại |
| `POST /api/v1/ai/recommendations/detailed` | Kết quả đầy đủ, điểm thành phần, chiến lược và cảnh báo |
| `POST /api/v1/ai/chat` | Adapter camelCase, chat lập lịch dạng preview, không tự lưu lịch nghiệp vụ |

Ví dụ tìm kiếm:

```json
{"query":"biển yên tĩnh","filters":{"city":"Đà Nẵng","place_type":"Attraction"},"limit":10,"infer_filters":false}
```

Ví dụ Recommendation:

```json
{"userId":"USER_ID_FROM_BACKEND_SESSION","query":"thích biển và thiên nhiên","city":"Đà Nẵng","preferences":["biển","thiên nhiên"],"limit":10,"usePreference":true}
```

`userId` có mặt và `usePreference=true` dùng `personalized_mmr`; khách chưa đăng nhập hoặc tắt cá nhân hóa dùng `content_rating`. Backend có thể truyền `preferences` từ chức năng sở thích hiện có; AI không tự đọc bảng sở thích của backend. `price=null` nghĩa là thiếu dữ liệu giá, không phải miễn phí. ID địa điểm của catalog AI có thể khác UUID PostgreSQL; bên gọi cần ánh xạ ID trước khi dùng các API backend yêu cầu UUID.

Ví dụ chat:

```json
{"userId":"USER_ID_FROM_BACKEND_SESSION","message":"Lập lịch Đà Nẵng 3 ngày, thích biển","useLlm":true}
```

Giữ `conversation_id` trả về và gửi lại trong trường `conversationId`; khi đã có preview, gửi thêm `draftId` và `expectedVersion`. Nếu thiếu ngày đi, AI trả `status=needs_clarification`. Có thể đặt `useLlm=false` để kiểm thử parser mà không gọi Gemini. Tên trường trong response giữ nguyên hợp đồng AI, không tự đổi toàn bộ response sang camelCase.

Backend đã có các API nội bộ `/api/v1/internal/routing/matrix` và `/api/v1/internal/trip-planner/*`, bảo vệ bằng service key. Đã kiểm thử trên giao diện chính với đăng nhập thật, Gemini và ORS thật, chỉnh sửa, lưu PostgreSQL và mở lại lịch. Các adapter `/api/v1/ai/*` ở trên vẫn nằm tại AI service; chưa tự nối Recommendation/search của giao diện chính trong phạm vi chatbot này. Các endpoint cũ dùng routing cấu hình và demo cũ vẫn được giữ tương thích. Preview ORS không tự hạ sang khoảng cách ước tính khi thiếu dịch vụ.

Kiểm thử adapter:

```bash
python -m unittest tests.test_backend_integration_contract -v
python -m unittest discover -s tests -q
```

OpenAPI đầy đủ nằm ở `contracts/openapi.json` và `/docs` khi AI chạy.

## Chat và lịch trình trong cùng một màn hình

Gemini tự thử lại tối đa 3 lượt trong ngân sách request khoảng 30 giây khi gặp lỗi HTTP 429/5xx, lỗi kết nối hoặc structured output không hợp lệ. Không tự chuyển sang chế độ không LLM khi người dùng đã bật Gemini. Lỗi xác thực/quyền/model không khả dụng được trả thông báo riêng và không retry; lỗi quota hoặc quá tải vẫn có thể xảy ra sau khi hết số lượt thử. Không log key hay nội dung prompt/provider error body. Giao diện giữ lịch hiện tại và đưa lại tin nhắn vào ô soạn nếu yêu cầu thất bại.

Trong `/demo`, tab **Chat & lịch trình** gồm khung trò chuyện và lịch trình theo từng ngày, không còn tab/form tạo lịch riêng. Nhắn yêu cầu lập lịch, trả lời thông tin còn thiếu ngay trong chat; lịch tạo hoặc sửa được hiển thị bên cạnh. Câu hỏi thông thường không xóa lịch trình đang xem. Nút **Yêu cầu thay điểm** điền sẵn ngày/tên địa điểm vào ô chat để bạn bổ sung lựa chọn thay thế và gửi.

Client gửi conversation ID cùng trip ID/version hiện tại để giữ ngữ cảnh và kiểm tra phiên bản khi chỉnh sửa. Nút **+ Mới** bắt đầu hội thoại mới, xóa lịch đang hiển thị trên giao diện, không xóa lịch đã lưu trong database. Các API tạo/đọc/chỉnh lịch hiện có vẫn được giữ. Gemini mặc định bật trong tab; có thể bỏ chọn để thử luồng trích xuất theo luật mà không gọi LLM. Khóa vẫn chỉ nhập trong Cài đặt kết nối chung.

## Đánh giá chức năng Tìm địa điểm

### Giao diện truy vấn và gán nhãn trực tiếp

Mở **http://localhost:9002/evaluation** hoặc bấm **Gán nhãn & đánh giá tìm kiếm** từ `/demo`. Mở Cài đặt kết nối và nhập service key; khóa chỉ giữ trong bộ nhớ trang.

1. Nhập query, thành phố, loại địa điểm và Top K, rồi bấm **Tìm kiếm & tạo lượt đánh giá**. API tìm kiếm thật được gọi với bộ lọc tường minh, không infer qua LLM. Mỗi lượt đóng băng corpus trong phạm vi city/type, thứ hạng, model, latency và tài nguyên.
2. Chấm **0/1/2/3** theo mức độ đáp ứng query. Có mô tả, danh mục, tags, tiện ích để kiểm tra bằng chứng; không tự gán nhãn dựa trên score model.
3. Chuyển **Toàn bộ phạm vi** để duyệt các điểm không được model trả về. Có lọc tên/nội dung, chỉ xem chưa gán nhãn, phân trang 20 và nút gán 0 cho những mục chưa chấm trên trang đang xem. Nút này là thao tác chủ động của người gán nhãn, không phải kết luận tự động.
4. **Lưu nhãn & tính chỉ số** yêu cầu đã chấm tất cả kết quả Top K. Nếu chưa duyệt toàn corpus trong phạm vi, UI đánh dấu Recall/nDCG là tạm tính trên tập đã gán nhãn. Nhãn bỏ trống không được coi là nhãn 0 đã xác nhận. Chỉ khi đã duyệt đầy đủ mới có đánh giá scope hoàn chỉnh.
5. Có thể mở lại lượt đã lưu trong SQLite AI (`search_evaluations`), xuất CSV/JSON hoặc in/lưu PDF. Mỗi lần lưu kiểm tra version để tránh ghi đè thay đổi từ tab khác.
6. **Tính chỉ số cả bộ** chỉ lấy query đã gán nhãn đầy đủ và scope không rỗng, loại query chưa hoàn chỉnh. Query trùng cả nội dung/bộ lọc/K dùng lượt mới nhất; quét tối đa 500 lượt gần nhất. Các K khác nhau có thể có số query được tính khác nhau. MRR ở đây là trung bình các query; bảng một lượt tương ứng RR của query đó.

Latency trên màn hình là thời gian server của **một lượt**, chưa phải p95 hoặc benchmark nhiều lần sau warmup. RAM là RSS process API lấy mẫu 50ms, không bao gồm Qdrant; có thể bỏ lỡ peak ngắn. VRAM CPU hiển thị không áp dụng; CUDA nếu có báo allocation hiện tại, không phải peak. Thống kê latency cả bộ từ các lượt đã lưu cũng có thể gồm lượt cold/warm lẫn nhau; dùng script bên dưới để benchmark theo protocol cố định.

Giao diện đánh giá dùng service key nội bộ; chưa có tài khoản/role cho từng người gán nhãn. Không dùng chung key này như API public cho người dùng cuối.

Bộ nhãn tại `evaluation/datasets/place-search-v1/`: 36 truy vấn tiếng Việt trên địa điểm thật tại Đà Nẵng, Hội An và Huế, gồm truy vấn theo nhu cầu, tên cụ thể và tên không dấu. `queries.jsonl` có query, bộ lọc thành phố/loại, split validation/test và tiêu chí relevance; `judgments.csv` chứa query ID, place ID, grade 0–3, tên, lý do và trạng thái duyệt; `corpus.jsonl` lưu nội dung bằng chứng; `manifest.json` lưu nguồn/hash và quy ước.

**Đây là silver labels sinh bằng luật trên metadata, chưa phải nhãn con người xác nhận.** Nhãn được tạo độc lập với kết quả model, nhưng có thể bỏ sót cách diễn đạt đồng nghĩa hoặc gán nhãn sai do dữ liệu nguồn thiếu/sai. Không dùng các chỉ số nháp làm kết luận chất lượng trong luận văn. Các query dễ theo tên cũng phải báo riêng, tránh làm lu mờ chất lượng semantic search.

### Cách duyệt nhãn

1. Đọc query và tiêu chí trong `queries.jsonl`; dùng `corpus.jsonl` để tra đúng địa điểm, không nhìn thứ hạng model khi gán nhãn.
2. Trong `judgments.csv`, sửa `grade`: **3** đáp ứng rõ/đầy đủ, **2** phù hợp, **1** chỉ đáp ứng một phần, **0** không phù hợp. Đánh giá dựa trên thông tin được cung cấp, không tự bịa tiện ích. Nếu không đủ bằng chứng, cần kiểm tra bổ sung thay vì khẳng định không liên quan.
3. Sau khi kiểm tra từng cặp, đặt `review_status=reviewed` và ghi lý do. Không chỉ duyệt các kết quả Top K: Recall cần xác định đầy đủ các địa điểm relevant trong phạm vi query.
4. Nên có hai người gán nhãn độc lập, thống nhất bất đồng; dùng validation để chỉnh trọng số/ngưỡng, giữ test riêng. Hiện split chỉ là khởi tạo, cần rà soát tương đồng giữa query để tránh leakage.
5. Snapshot đóng băng theo ID; nếu thay dữ liệu/index, lưu phiên bản mới hoặc kiểm tra lại nhãn. Không chạy sinh lại dataset đè lên file đã duyệt.

### Chạy đánh giá

Từ thư mục gốc, khi AI + Qdrant đã chạy:

```powershell
python ai/scripts/evaluate_place_search.py --dataset ai/evaluation/datasets/place-search-v1 --allow-draft --repeats 3 --warmup 2 --output ai/data/search-evaluation
```

Script dùng root `.env` hoặc biến `RECOMMENDATION_API_KEY`/`AI_SERVICE_API_KEY`, không in khóa. Default URL `http://127.0.0.1:9002`, K=5,10,20. Đổi bằng `--base-url`, `--ks 5,10,20,50`, `--split test`. Nếu muốn chỉ thử nhanh: thêm `--max-queries 3 --repeats 1`. Bỏ `--allow-draft` sau khi đã duyệt toàn bộ nhãn được chọn; script từ chối nhãn chưa duyệt nếu thiếu cờ này.

Đo RAM qua Docker cần quyền truy cập Docker Desktop. `--container datn-n7-ai-1` xác định đúng AI API; có thể dùng `--skip-resources` để chỉ đo chất lượng/latency. Không tự dừng các dự án khác.

Kết quả: `summary.json` tổng hợp + phiên bản/hash, `metrics.csv` macro trung bình và nhóm truy vấn, `per-query.csv` theo từng query, `runs.jsonl` ID xếp hạng/lỗi/retrieval, `resources.jsonl` mẫu RAM. Không ghi mật khẩu hoặc API key. Thư mục `ai/data/` được Git ignore.

### Định nghĩa chỉ số

- **Recall@K** = số địa điểm relevant trong Top K / tổng số địa điểm relevant của query. Relevant là grade >=2; mẫu số không phải K. Query có nhiều đáp án nên Recall@5 có thể thấp dù 5 kết quả đầu đều đúng.
- **MRR@K** = trung bình `1/rank` của kết quả relevant đầu tiên trong Top K; không có thì 0.
- **nDCG@K** = DCG/IDCG; gain `2^grade−1`, chiết khấu `log2(rank+1)`. Grade 1 vẫn có gain nhỏ dù không tính là binary relevant.
- Query không có positive được loại khỏi Recall/MRR và báo số query tính; IDCG=0 thì nDCG không xác định. Request lỗi được coi là danh sách rỗng, không loại khỏi chất lượng để tránh làm đẹp số liệu. ID chưa được gán nhãn tạm tính grade 0, đồng thời báo `judged_coverage`; coverage thấp cần bổ sung nhãn.
- Trung bình các lần lặp trong từng query, rồi macro-average các query. Không cộng dồn relevant của query có nhiều nhãn để chi phối toàn bộ bộ test.
- **Latency**: mean/p50/p95/max của HTTP end-to-end sau warmup, gọi tuần tự. Một request lấy max(K), các metric K nhỏ cắt từ cùng thứ hạng; latency là cho max(K), không phải thời gian riêng cho mỗi K. Không gồm khởi động/tải model, không phải kernel inference thuần. Báo lỗi request riêng. Cần phép đo tải đồng thời riêng để kết luận throughput production.
- **RAM**: RSS process AI API PID 1, baseline và peak quan sát lấy mẫu ~1 giây; HWM là từ lúc process khởi động, không chỉ lượt test. Cgroup memory là toàn container, cách hạch toán shared pages/cache khác RSS, không cộng hai số. Chưa tính RAM Qdrant. Lấy mẫu có thể bỏ lỡ peak ngắn và việc polling gây overhead nhỏ.
- **VRAM**: model text hiện ép chạy CPU, nên `vram_mib=null`, trạng thái không dùng VRAM cho text embedding; không bịa số 0 như một phép đo GPU. `nvidia-smi` nếu có chỉ đo thêm peak bộ nhớ toàn thiết bị, có thể gồm màn hình/dự án khác, không quy cho riêng AI. Muốn benchmark GPU cần triển khai device CUDA và đo trong process model.

Phép đo dùng toàn bộ `/api/v1/search/places` hiện tại (semantic + keyword + lọc), `infer_filters=false` để bộ lọc không phụ thuộc parser/LLM. Không dùng rotation Recommendation. Giữ dataset/index/hardware cố định khi so sánh baseline; các trường retrieval/warnings giúp phát hiện fallback khác đường chạy.

## Phương án bổ sung: hành vi cá nhân + Bayesian Rating + MMR

### Làm mới một phần danh sách giữa các lần gợi ý

Chế độ `personalized_mmr` mặc định có `refresh_variety=true`. Sau xếp hạng theo hồ sơ + rating và MMR, giữ khoảng 70% đầu danh sách làm điểm neo; dành phần còn lại (làm tròn lên 30%) cho địa điểm không có trong danh sách trước. Ưu tiên ứng viên chưa xuất hiện trong cả 3 danh sách gần nhất, sau đó mới nới sang chỉ khác danh sách trước. Ứng viên thay thế vẫn phải vượt bộ lọc, có vector hợp lệ, nằm trong Top-N và có relevance không thấp hơn điểm tốt nhất quá 0.15. MMR tiếp tục chọn giữa các ứng viên mới dựa trên những điểm neo đã giữ.

Lịch sử danh sách lấy từ các response đã lưu cho đúng user, không biến việc được đề xuất thành sở thích tích cực. Không đủ địa điểm mới phù hợp thì giữ lại kết quả và trả warning/diagnostics; không bảo đảm thay đúng 30% khi tập ứng viên cạn. `fresh_since_last` đánh dấu điểm mới so với danh sách ngay trước. Tắt checkbox **Thêm lựa chọn mới mỗi lần gợi ý** hoặc gửi `refresh_variety=false` để so sánh thuật toán cố định; riêng khi tắt rotation, lambda=1 giữ nguyên thứ tự relevance. Phương án `content_rating` không áp dụng rotation. Các tỷ lệ 30% và ngưỡng 0.15 là lựa chọn ban đầu để thực nghiệm, không phải thông số tối ưu.

Trên tab Recommendation, khung **Người dùng thử nghiệm có lịch sử** tự tải các hồ sơ `demo-beach-*` đã được script tạo. Chọn hồ sơ để thấy từng hành vi và tên địa điểm; nút **Xem gợi ý cho người dùng này** đặt đúng User ID, chọn chế độ hành vi, lọc Attraction tại Đà Nẵng và để trống sở thích/query để quan sát tác động của lịch sử. **Tải lại lịch sử** cập nhật các hành vi vừa ghi nhận. API có bảo vệ service key: `GET /api/v1/recommendation/demo-users` và `GET /api/v1/users/{user_id}/interactions?limit=100&offset=0`. Backend tích hợp phải kiểm tra quyền xem lịch sử theo session; đây vẫn là công cụ demo nội bộ.

Để tạo một hồ sơ thử riêng, mô phỏng tương tác với địa điểm thật trong catalog và xuất báo cáo trước/sau, chạy từ thư mục gốc:

```powershell
python ai/scripts/simulate_user.py --base-url http://localhost:9002 --output simulated-user-report.json
```

Script đọc service key từ môi trường hoặc root `.env`, không in khóa. Mỗi lần chạy tạo User ID mới dạng `demo-beach-*`, sở thích khai báo rỗng; mô phỏng xem, yêu thích và lưu các điểm biển/thiên nhiên tại Đà Nẵng. Không tạo/sửa địa điểm hoặc giả mạo review. Báo cáo chứa sự kiện mô phỏng, gợi ý trước lịch sử, sau lịch sử (`lambda=1`) và sau MMR (`lambda=0.7`). Đây là kiểm tra chức năng, không phải đánh giá chất lượng thực nghiệm. Dùng User ID được in ra trong demo để tiếp tục tương tác.

`POST /api/v1/recommendations` hỗ trợ `mode: "personalized_mmr"`; mặc định vẫn là `content_rating` để so sánh. Phương án cũ không đọc lịch sử hành vi. Các đoạn mô tả không dùng lịch sử bên dưới nói về phương án mặc định.

Luồng mới: ghi nhận hành vi → tổng hợp theo địa điểm → lấy vector BGE-M3 hiện có → trung bình vector có trọng số và chuẩn hóa → kết hợp sở thích khai báo bằng `preference_alpha` → kết hợp query hiện tại nếu có → lọc điều kiện bắt buộc → chấm nội dung + Bayesian Rating → lấy Top-N → chọn tuần tự bằng MMR.

Trọng số khởi tạo: xem một lần 1, xem lặp tối đa 2 cho mỗi địa điểm; yêu thích 3; lưu 4; rating tích cực `5 × max(0, (rating − 3)/2)`. Hành vi cùng địa điểm được cộng; yêu thích/lưu dùng trạng thái mới nhất, bỏ chọn không tiếp tục cộng điểm. Rating mới nhất dưới 3 sao loại địa điểm khỏi gợi ý và khỏi hồ sơ tích cực; 3 sao trung tính. Không trừ vector tiêu cực vào hồ sơ. Chưa dùng suy giảm thời gian hay collaborative filtering. Đây là tham số thực nghiệm, chưa chứng minh tối ưu.

`preference_alpha` mặc định 0.5: cân bằng vector sở thích khai báo và lịch sử. Chỉ có một nguồn thì dùng nguồn đó; thiếu cả hai dùng query, hoặc rating nếu query cũng trống. Chỉ lấy vector đúng model/document version và địa điểm còn hoạt động. Hồ sơ tính lại mỗi request từ bảng `recommendation_interactions` trong SQLite AI, không huấn luyện lại embedding và không đọc các bảng hành vi cũ.

MMR dùng relevance là **điểm nội dung + Bayesian Rating**, thay vì chỉ cosine, nhằm giữ thành phần rating của phương án hiện tại. Cosine giữa hai địa điểm được đưa về `[0,1]`; relevance cũng trong `[0,1]`. `mmr_lambda` mặc định 0.7, có thể khảo sát 0.3/0.5/0.7/0.9/1.0. `mmr_pool_size` mặc định 100, tối đa 500, phải >= limit. Điểm đầu tiên chỉ theo relevance; các bước sau trừ mức tương đồng lớn nhất với điểm đã chọn. Thiếu vector dùng mức phạt bảo thủ 1, không coi là mới lạ. `lambda=1` giữ thứ tự relevance. MMR không đảm bảo quota loại hình hoặc cải thiện chất lượng nếu chưa đánh giá thực nghiệm.

### Ghi nhận hành vi

API nội bộ, yêu cầu `X-API-Key`; backend thật phải lấy user ID từ session, không tin ID tùy ý từ client. Demo dùng User ID nhập tay để thực nghiệm. Review từ dataset không tự biến thành hành vi người dùng.

```http
POST /api/v1/users/demo-user/interactions
```

```json
{"event_id":"unique-event-001","place_id":"real-place-id","action":"save","active":true,"occurred_at":"2026-11-19T07:00:00Z"}
```

`action`: `view`, `favorite`, `save`, `rating`. Favorite/save yêu cầu `active` true/false. Rating yêu cầu `rating` 1–5. Timestamp phải có timezone và không ở tương lai. Retry cùng event ID và cùng nội dung không cộng lại; đổi nội dung cùng ID trả 409. `DELETE /api/v1/users/{user_id}/interactions` xóa lịch sử để reset thử nghiệm.

```json
{"user_id":"demo-user","mode":"personalized_mmr","preferences":["biển","thiên nhiên"],"city":"Đà Nẵng","preference_alpha":0.5,"mmr_lambda":0.7,"mmr_pool_size":100,"limit":10}
```

Response giữ `score` là relevance trước MMR, thêm `mmr_score`, `redundancy_score`; thứ tự sau MMR không nhất thiết giảm dần theo `score`. Diagnostics có số sự kiện, số địa điểm lịch sử hợp lệ, nguồn hồ sơ và tham số. Demo `/demo` có chọn phương án, alpha/lambda; mở chi tiết ghi nhận view, có nút yêu thích/lưu/bỏ chọn và đánh giá sao. Các nút là gửi trạng thái trực tiếp, không hiển thị trạng thái đã lưu từ trước. Backend/frontend chính chưa tự gửi các sự kiện này.

Đánh giá bằng chia lịch sử theo thời gian, giữ tương tác tương lai làm test, không đưa test vào hồ sơ. So sánh relevance (Recall/NDCG@K) cùng đa dạng (intra-list diversity, coverage) với baseline, báo riêng cold start. Tránh coi dữ liệu minh họa là kết quả thực nghiệm.

Mã AI nằm trong `ai/`, cùng một Git với `be/` và `fe/`. Chạy Docker từ thư mục gốc bằng `docker compose up -d --build`. Cấu hình Docker dùng `.env` ở gốc; không cần sao chép khóa vào mã nguồn hoặc frontend.

- AI API và Swagger: http://localhost:9000/docs
- Giao diện thử: http://localhost:9000/demo
- Backend gọi nội bộ: `http://ai:9000`, header `X-API-Key` dùng `AI_API_KEY` của backend (cùng `AI_SERVICE_API_KEY` trong root .env).
- API AI dùng service key nội bộ. Backend chịu trách nhiệm xác thực người dùng và phân quyền trước khi gọi AI.

- Recommendation hiện dùng [Content-based + Bayesian rating](#recommendation), không đọc tương tác hay dùng ItemKNN.

## Mục lục

- [Vận hành, lưu trữ và kiểm thử](#van-hanh)
- [Recommendation: Content-based + Rating](#recommendation)
- [Tìm địa điểm bằng văn bản](#tim-dia-diem)
- [Embedding và tìm kiếm ảnh CLIP](#tim-anh)
- [Chatbot và điều phối công cụ](#chatbot)
- [Tạo và chỉnh lịch trình](#lich-trinh)

<a id="van-hanh"></a>

## Lưu trữ

SQLite AI ở `/app/data/recommendation.sqlite3`, Qdrant ở service `qdrant`, model cache ở `/root/.cache/huggingface`. Đây là các volume, không phải file cần commit. PostgreSQL của backend là kho riêng; việc hợp nhất Docker không tự chuyển SQLite sang PostgreSQL.

Collection chính `documents_bge_m3` / `dense`, vector factual `facts-v2`. CLIP dùng `tourism_images_clip_v1`. Sparse được giữ theo thiết kế collection nhưng Recommendation hiện dùng dense. Xem [Recommendation](#recommendation) để biết công thức, giới hạn dữ liệu và cách đánh giá.

## Import và kiểm thử

Từ thư mục `ai/`, môi trường Python cài `requirements.txt` và `requirements-dev.txt`:

```bash
python -m unittest discover -s tests -q
python scripts/index_places.py /path/to/cleaned.xlsx
python scripts/index_places.py /path/to/cleaned.xlsx --send
```

Nếu chạy script trực tiếp trên host, đặt `RECOMMENDATION_API_KEY` trùng root `AI_SERVICE_API_KEY` trong môi trường hoặc một file `ai/.env` được Git ignore. `ai/.env.example` chỉ dành cho chạy native; Compose luôn dùng biến môi trường từ root.

Hợp đồng OpenAPI được lưu tại `contracts/openapi.json`; API runtime `/openapi.json` là bản tương ứng với mã đang chạy. Review được lưu riêng với cờ tuyển chọn; không ghép vào vector địa điểm. Dữ liệu Excel không đi kèm Git.

## Cấu trúc theo luồng đang dùng

- `app/modules/recommendation/`: Content-based + Bayesian rating, sở thích khai báo và lưu kết quả đề xuất.
- `app/modules/semantic_search/`: embedding BGE-M3, tìm kiếm văn bản và ảnh CLIP.
- `app/modules/trip_planner/`: chọn địa điểm, ma trận di chuyển, xếp lịch và kiểm tra ràng buộc.
- `app/agents/`, `app/workflows/`, `app/tools/`, `app/memory/`, `app/llm/`: điều phối chat, gọi nghiệp vụ và giữ ngữ cảnh chuyến đi; Gemini trích xuất yêu cầu khi được bật.
- `app/database/`, `app/core/`, `app/api/`: lưu trữ, cấu hình, bảo vệ API và định tuyến.
- `scripts/`: import dữ liệu Excel; `tests/`: kiểm thử các luồng trên; `contracts/`: hợp đồng OpenAPI.

Không còn module tương tác, ItemKNN, huấn luyện/đánh giá mô hình offline hoặc connector PostgreSQL thử nghiệm của AI. Các module chat/tool hiện tại được giữ vì đang được gọi trong luồng chạy thực tế.

<a id="recommendation"></a>
## Recommendation: Content-based + Bayesian rating

Đây là thuật toán Recommendation duy nhất của AI service. `service.py` quản lý index và trạng thái; `content_rating.py` truy xuất và xếp hạng; `profiles.py` xử lý sở thích khai báo/query; `ranking.py` tính chất lượng Bayesian. Không có lịch sử hành vi, ItemKNN, huấn luyện offline, giảm lặp hoặc khám phá ngẫu nhiên.

### Dữ liệu và embedding

- Dữ liệu địa điểm, rating và review_count đã có trong catalog; không sinh thêm dữ liệu giả.
- `place_document.py` ghép tên, loại, thành phố, danh mục, tiện ích, tags, phong cách và mô tả thành văn bản `facts-v2`.
- BGE-M3 tạo vector 1.024 chiều chuẩn hóa. Qdrant: `documents_bge_m3`, named vector `dense`.
- Rating, review_count và tọa độ không ghép vào embedding. Review văn bản và cờ `use_for_embedding` không ảnh hưởng vector hoặc thứ hạng.
- Đổi rating/review_count chỉ cập nhật metadata; không embedding lại nếu nội dung và model không đổi.

### Đầu vào

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

API chỉ giữ các trường phục vụ luồng hiện tại. Đã bỏ `/interactions`, `/impressions`, các trường `exclude_seen`, `exploration`, điểm cộng đồng/điểm khoảng cách và các biến cấu hình hybrid. Gửi trường request đã bỏ sẽ bị từ chối 422. Dữ liệu cũ trong database không bị xóa; các bảng hành vi cũ nếu có không được đọc hoặc ghi.

### Luồng thuật toán

1. Embedding từng sở thích khai báo; gom các vector gần nhau theo ngưỡng cosine 0,92, giữ tối đa 3 nhóm. Không dùng lịch sử người dùng.
2. Embedding query riêng. Nội dung phù hợp với nhóm tốt nhất được điều chỉnh theo trọng số hỗ trợ nhóm. Có cả query và nhóm: 70% query + 30% nhóm; chỉ có một nguồn thì dùng nguồn đó.
3. Lọc các điều kiện bắt buộc trước khi xếp hạng.
4. Truy xuất ứng viên qua vector query và các nhóm, chia ngân sách khoảng 500 kết quả giữa các nguồn. Hợp nhất thêm 100 ứng viên chất lượng và các mục chờ đồng bộ. Số ứng viên sau hợp nhất có thể lớn hơn 500.
5. Nếu Qdrant lỗi hoặc không có ứng viên hợp lệ, tính nội dung chính xác trên các vector catalog hiện có; không tự nới bộ lọc.
6. Tính điểm nội dung và Bayesian rating theo công thức dưới đây, sắp điểm giảm dần. Hòa điểm thì theo place_id để ổn định.
7. Hiển thị tối đa một bản ghi có cùng tên chuẩn hóa, thành phố và loại. Quy tắc này không gộp hoặc xóa dữ liệu nguồn. Có thể trả ít hơn limit nếu không đủ tên khác nhau.

### Công thức điểm

`C = (cosine_nội_dung + 1) / 2`

`Q = ((n × r + m × μ) / (n + m) - 1) / 4`

- r: rating của địa điểm trên thang 1–5.
- n: review_count của địa điểm; bằng 0 nếu thiếu rating.
- μ: trung bình rating có trọng số review_count của các địa điểm đang hoạt động, phù hợp chính sách loại địa điểm, trong cùng thành phố và loại. Chưa có nhóm hợp lệ thì dùng mức tham chiếu 3,5.
- m: độ mạnh tham chiếu, mặc định 50 (`REC_PRIOR_STRENGTH`).
- Chưa đủ rating/lượt đánh giá thì dùng mức tham chiếu và giải thích rõ. Đây không phải rating đã được xác minh cho địa điểm đó.

`score = 0,75 × C + 0,25 × Q` theo cấu hình mặc định. Các giá trị gốc 0,6 và 0,2 được chuẩn hóa trên hai nguồn, không thêm trọng số cộng đồng hay khoảng cách. Đây là heuristic chưa được hiệu chỉnh bằng ground truth; score không phải xác suất yêu thích.

Không có query hoặc sở thích: dùng `score = Q`, strategy `rating_fallback`. Ứng viên thiếu vector đúng phiên bản cũng chỉ dùng Q và được báo trong warnings. Trọng số thực tế từng mục được trả trong effective_weights.

Tọa độ vẫn phục vụ lọc bán kính và hiển thị distance_km, không cộng/trừ điểm khoảng cách.

### Kết quả và kiểm tra

- strategy: content_rating hoặc rating_fallback.
- model_version bắt đầu content-rating-v1-; phiên bản vector vẫn facts-v2 nên không cần re-embedding toàn bộ catalog.
- Mỗi mục có content_score (cosine, -1..1), quality_score (0..1), score, rating, review_count, effective_weights và reasons.
- diagnostics có mode=content_rating, số nhóm sở thích, số ứng viên, nguồn rating và cảnh báo dữ liệu.
- Lưu kết quả request để đọc lại không đồng nghĩa ghi nhận hành vi hoặc hiển thị; không dùng những bản ghi này để chấm điểm.
- Trip Planner dùng được cùng ranker. Search BGE + BM25 là luồng riêng và không đổi.

```powershell
python -m unittest discover -s tests -p test_content_rating.py -q
python -m unittest discover -s tests -q
```

Test dùng embedding giả, Qdrant in-memory và database tạm. Bao gồm tính điểm, cold start, từ chối API hành vi đã bỏ và bảo toàn dữ liệu cũ, lọc bắt buộc, fallback, cập nhật rating không re-embedding, kết quả xác định và tích hợp Trip Planner. Test đúng công thức không chứng minh hiệu quả khuyến nghị thực tế; cần bộ nhãn đánh giá riêng để tune trọng số.

<a id="tim-dia-diem"></a>
## Tìm địa điểm bằng văn bản

POST `/api/v1/search/places`. API tìm địa điểm độc lập recommendation, không cần user_id, không đọc lịch sử, không chèn khám phá hoặc tự nới bộ lọc. Dữ liệu lấy từ catalog SQLite được nạp qua API embedding/place(s) hoặc places/batch; các point chỉ tồn tại trong Qdrant mà chưa vào catalog này không được tìm bởi endpoint mới.

### Request

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

### Response

- `request_id`: ID của lần tìm, hiện không lưu search log và không dùng ID này để ghi nhận hành vi.
- `query`, `parser`: câu gốc và phiên bản parser.
- `inferred_filters`: điều kiện nhận diện trước ưu tiên explicit.
- `applied_filters`: bộ lọc thực sự áp dụng.
- `unsupported_requirements`: yêu cầu chưa kiểm chứng được, ví dụ giá <1 triệu, khoảng cách đến biển, đang mở cửa.
- `warnings`: mơ hồ, ghi đè điều kiện, vector cũ/thiếu, không có kết quả.
- `total`, `offset`, `limit`, `results`: tổng kết quả sau lọc/ngưỡng và trang hiện tại.
- Mỗi result có place_id, tên, loại, thành phố, image_url, khoảng cách nếu tính được, semantic_score (cosine), keyword_score (BM25), score (RRF), exact_name_match và lý do.

`min_similarity` tùy chọn (-1..1) lọc cosine tối thiểu; vector cũ/thiếu không thể đạt ngưỡng này. Không có ngưỡng được hiệu chỉnh mặc định, nên khi không đặt ngưỡng, nội dung ít liên quan vẫn có thể xuất hiện ở cuối danh sách. Các điểm không phải xác suất hài lòng. Truy vấn nguyên tên địa điểm được ưu tiên khớp chính xác sau khi vẫn phải qua tất cả bộ lọc.

### Cách tính

1. Lấy bản ghi active, suy ra và áp dụng bộ lọc.
2. Encode query bằng BGE hiện có. Chỉ dùng vector cùng model và content_hash hợp lệ.
3. Tính cosine chính xác bằng numpy trên vector lưu SQLite. Endpoint này hiện không gọi Qdrant ANN; phù hợp catalog vài nghìn nơi và vẫn hoạt động khi Qdrant tạm lỗi. Qdrant tiếp tục được ghi qua API nạp dữ liệu và dùng bởi các luồng khác.
4. BM25 trên tên (lặp 3 lần), danh mục, tags, tiện ích, mô tả và thành phố, có chuẩn hóa dấu. Đây là tokenizer từ đơn đơn giản, chưa có bộ tách từ tiếng Việt chuyên dụng. k1=1.2, b=0.75.
5. Trộn theo thứ hạng RRF: tổng `1/(60+rank)` của hai nguồn; không cộng trực tiếp thang cosine và BM25. Exact whole-name đứng trước, sau đó RRF; tie theo place_id để phân trang ổn định khi catalog không đổi.

Vector cũ/thiếu chỉ tham gia BM25 và được cảnh báo. Không dùng CLIP text encoder cho search địa điểm. Không có LLM sinh câu trả lời hoặc cross-encoder reranker trong phiên bản này. Những câu phức tạp cần frontend/backend gửi bộ lọc rõ ràng hoặc bổ sung parser tốt hơn sau khi có bộ query đánh giá.

Khi catalog/lưu lượng lớn cần lexical index và vector retrieval phía server thay vì đọc toàn bộ catalog. Chất lượng semantic/BM25/RRF và luật nhận diện cần đánh giá trên query tiếng Việt thực tế, không được suy từ unit tests.

### Kết nối backend

Gửi `Content-Type: application/json` và `X-API-Key` khi cấu hình `RECOMMENDATION_API_KEY`. Lỗi payload 422, thiếu key 401. Không cần cài thêm dependency hoặc tạo collection mới. Compose chạy image đóng gói; sau khi đổi mã, chạy `docker compose up -d --build --no-deps ai` từ thư mục gốc.

Search response khác recommendation response: chưa lưu vào bảng impressions recommendation. API ghi hành vi đã được loại khỏi AI service; backend có thể quản lý analytics riêng nếu cần.

Tài liệu thuật toán tham khảo: [BM25 parameters](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity), [rank fusion](https://qdrant.tech/documentation/search/hybrid-queries/).

<a id="tim-anh"></a>
## Embedding và tìm kiếm ảnh CLIP

Collection riêng `tourism_images_clip_v1`, named vector `image_dense`, 512 chiều, cosine. Model mặc định `openai/clip-vit-base-patch32` qua Transformers. Vector chuẩn hóa L2; không so trực tiếp với vector BGE của địa điểm. Một ảnh là một point, payload có `place_id` để search engine lấy chi tiết địa điểm từ backend. Nhiều ảnh có thể liên kết cùng địa điểm.

### Backend nạp ảnh

POST `/api/v1/embeddings/image`

```json
{
  "image_id": "place-123-photo-1",
  "place_id": "123",
  "image_base64": "BASE64_CUA_FILE_ANH",
  "image_url": "https://your-cdn.example/places/123/photo-1.jpg",
  "city": "Đà Nẵng",
  "place_type": "Attraction",
  "index": true
}
```

`image_id` phải duy nhất toàn hệ thống. Gửi lại cùng ID cập nhật vector và thay payload, không tạo point mới. `place_id` là khóa backend, không bắt buộc đã nạp vào SQLite recommendation, vì search engine có thể dùng catalog backend riêng. `image_url` chỉ lưu để hiển thị, service không tải URL. Backend cần đọc/download ảnh trước rồi gửi bytes base64 hoặc data URL `data:image/jpeg;base64,...`. JPEG, PNG, WebP được hỗ trợ, tối đa 8 MB decoded và 16 triệu pixels. Không gửi đường dẫn file nội bộ hoặc URL thay cho base64.

Response:

```json
{
  "image_id": "place-123-photo-1",
  "place_id": "123",
  "point_id": "UUID_ON_DINH_THEO_IMAGE_ID",
  "model": "openai/clip-vit-base-patch32",
  "dimensions": 512,
  "collection": "tourism_images_clip_v1",
  "vector_name": "image_dense",
  "embedding": [0.01, 0.02],
  "indexed": true
}
```

Mảng embedding ở ví dụ đã rút ngắn; response thật có đúng 512 phần tử. Nếu chỉ cần vector và chưa muốn lưu, gửi `index:false`; khi đó có thể bỏ `image_id` và `place_id`. Không lưu bytes ảnh trong Qdrant/SQLite; backend/CDN giữ ảnh gốc. Vector ảnh chỉ lưu Qdrant, không có pending queue local. Lỗi Qdrant/model trả HTTP 503; backend cần giữ request và retry cùng ID. Payload/ảnh lỗi trả 422. Lần đầu model cần tải về cache nên chậm hơn các lần sau.

Ví dụ Python từ backend:

```python
import base64
import os
from pathlib import Path
import requests

response = requests.post(
    "http://localhost:9000/api/v1/embeddings/image",
    headers={"X-API-Key": os.environ["RECOMMENDATION_API_KEY"]},
    json={
        "image_id": "place-123-photo-1",
        "place_id": "123",
        "image_base64": base64.b64encode(Path("photo.jpg").read_bytes()).decode("ascii"),
        "city": "Đà Nẵng",
        "place_type": "Attraction",
        "index": True,
    },
    timeout=600,
)
response.raise_for_status()
result = response.json()
```

### Tìm ảnh tương tự

POST `/api/v1/search/images`

```json
{
  "image_base64": "BASE64_ANH_TRUY_VAN",
  "city": "Đà Nẵng",
  "place_type": "Attraction",
  "limit": 10
}
```

Không index ảnh truy vấn. Response `results` gồm `image_id`, `place_id`, `image_url`, `score` cosine và metadata. Kết quả được xếp theo độ tương tự ảnh, không phải xác suất đúng. Có thể có nhiều ảnh của cùng place; backend gộp theo place_id nếu muốn danh sách địa điểm, ví dụ lấy điểm cao nhất mỗi nơi. City khớp nhãn không phân biệt hoa thường; place_type khớp chính xác. Limit từ 1 đến 100. Collection rỗng trả danh sách rỗng.

Ngoài ảnh→ảnh, CLIP hỗ trợ text→ảnh trong cùng không gian vector:

```json
{"text": "a quiet beach with white sand", "city": "Đà Nẵng", "limit": 10}
```

Gửi đúng một trong `image_base64` hoặc `text`. Endpoint này dùng text encoder CLIP, không dùng BGE. Model mặc định ưu tiên query tiếng Anh; tiếng Việt cần đánh giá hoặc triển khai thêm encoder đa ngôn ngữ tương thích. Không tự động dịch hoặc cam kết chất lượng tiếng Việt. Truy vấn vượt giới hạn token CLIP bị từ chối, không âm thầm cắt.

### Collection và chạy dịch vụ

GET `/api/v1/search/images/collection` trả cấu hình và tổng số ảnh. Khi ứng dụng khởi động, collection được tạo nếu chưa có, không tải model ngay. Nếu Qdrant tạm lỗi, image API thử tạo lại ở lần gọi sau. Collection tồn tại sai cấu hình không bị tự xóa; cần cấu hình tên mới.

Biến môi trường trong `.env.example`:

```dotenv
CLIP_MODEL_NAME=openai/clip-vit-base-patch32
CLIP_DIMENSIONS=512
CLIP_DEVICE=cpu
IMAGE_COLLECTION_NAME=tourism_images_clip_v1
IMAGE_VECTOR_NAME=image_dense
```

Khi đổi model, tạo collection mới và nạp lại ảnh. Chỉ kết quả có cùng model fingerprint mới được tìm kiếm. CLIP dùng cùng Hugging Face cache volume hiện có; BGE và CLIP là hai model riêng nên cần thêm RAM. API dùng `X-API-Key` theo `RECOMMENDATION_API_KEY`, phục vụ backend tin cậy.

```powershell
docker compose up -d --build --no-deps ai
```

Swagger: http://localhost:9000/docs. API embedding ảnh hiện xử lý từng ảnh; backend có thể gửi lần lượt, chưa có image batch; đã hỗ trợ multipart upload theo hướng dẫn dưới đây.

Nguồn triển khai: [CLIP model card](https://huggingface.co/openai/clip-vit-base-patch32), [Transformers CLIP API](https://huggingface.co/docs/transformers/model_doc/clip).


### Chọn file trực tiếp trong Swagger (không cần backend/base64)

1. Mở http://localhost:9000/docs.
2. Chọn POST `/api/v1/embeddings/image/upload`, bấm **Try it out**.
3. Ở trường **file**, bấm **Choose File** và chọn ảnh JPG/PNG/WebP.
4. Giữ **index=false** nếu chỉ muốn kiểm tra vector, không ghi Qdrant; có thể bỏ trống các trường khác.
5. Bấm **Execute**, response có embedding 512 chiều với model mặc định.
6. Muốn lưu để tìm kiếm, đặt **index=true**, nhập image_id và place_id (ví dụ photo-test-1/place-test-1). Các trường city, place_type, image_url không bắt buộc.

Để tìm bằng file, chọn POST `/api/v1/search/images/upload`, chọn ảnh và limit rồi Execute. Ảnh truy vấn không được lưu. Nếu chưa index ảnh nào vào collection, kết quả tìm kiếm rỗng là bình thường.

Cả hai endpoint dùng multipart/form-data, cùng cơ chế API key như API JSON. JPEG/PNG/WebP tối đa 8 MB và 16 triệu pixels; file rỗng/hỏng trả 422, file quá dung lượng trả 413. Không dựa vào tên file hoặc MIME để khẳng định dữ liệu là ảnh: vẫn xác minh bytes ảnh. Không lưu file gốc; backend/CDN vẫn giữ ảnh gốc nếu cần.

Ví dụ terminal tại thư mục chứa ảnh:

```bash
curl -X POST "http://localhost:9000/api/v1/embeddings/image/upload" -F "file=@photo.jpg" -F "index=false"
curl -X POST "http://localhost:9000/api/v1/search/images/upload" -F "file=@photo.jpg" -F "limit=10"
```

PowerShell dùng curl.exe. Khi dùng curl -F, không tự đặt Content-Type vì curl phải sinh boundary multipart. API base64 cũ vẫn giữ nguyên. Môi trường tự chạy Python cần cài requirements.txt mới có python-multipart; Docker cần rebuild image.

<a id="chatbot"></a>
## Chatbot và điều phối công cụ

`POST /api/v1/chat` nhận `user_id`, `message`, `conversation_id` khi tiếp tục hội thoại và `use_llm` (mặc định false). Có thể gửi `intent` rõ ràng; nếu bỏ trống, hệ thống nhận diện ý định bằng luật trong `IntentRouter`.

Luồng xử lý: nhận tin nhắn → đọc ngữ cảnh hội thoại → xác định ý định → gọi agent/workflow tương ứng → trả kết quả và lưu ngữ cảnh. Các nhánh hiện tại:

| Ý định | Xử lý |
|---|---|
| `general_chat` | Chào hỏi, tính toán cơ bản; câu hỏi tổng quát dùng Gemini khi bật LLM |
| `travel_qa` | Hỏi thông tin du lịch dựa trên catalog |
| `place_search` | Tìm địa điểm qua Semantic Search |
| `trip_planning` | Hỏi thông tin còn thiếu rồi tạo lịch |
| `replanning` | Xác định lịch/ngày/địa điểm để chỉnh lịch |

`ToolRegistry` giới hạn các công cụ nghiệp vụ được phép gọi và kiểm tra danh tính người dùng. Workflow hiện tại gọi công cụ theo logic Python; đây chưa phải vòng lặp LLM function calling tự quyết định chuỗi công cụ. Khi `use_llm=true`, Gemini hỗ trợ sinh câu trả lời tổng quát hoặc trích xuất yêu cầu có cấu trúc; địa điểm và lịch trình vẫn do dữ liệu và thuật toán nghiệp vụ quyết định.

Khóa API AI là khóa dịch vụ nội bộ. Backend phải lấy `user_id` từ phiên đăng nhập và phân quyền trước khi chuyển yêu cầu đến AI.


<a id="lich-trinh"></a>
## Tạo và chỉnh lịch trình

Module tạo lịch trình từ catalog thật, ghép Semantic Search + Recommendation với ma trận di chuyển, greedy insertion và 2-opt có kiểm tra ràng buộc. Có lưu lịch trình/hội thoại SQLite và sửa riêng từng ngày. Đây là baseline heuristic giải thích được; không cam kết tối ưu toàn cục, tình trạng mở cửa hoặc giao thông thời gian thực.

### API

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

### 1. Tạo lịch từ backend

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

### 2. Cấu trúc kết quả

Response có trip_id, version, user_id, city, days, status, routing, warnings và unscheduled_required_place_ids.

Mỗi ngày có date, window, activities, total_distance_km, total_travel_minutes, end_time, return_leg, validation và routing riêng. Mỗi activity có:

- place_id, name, place_type và tọa độ thật từ catalog.
- start_time/end_time dạng ISO với +07:00, duration_minutes.
- departure_time/arrival_time, travel_time_from_previous/phút, distance_from_previous_km.
- waiting_minutes: chờ mở cửa và chờ qua giờ nghỉ.
- recommendation_score, opening_hours_checked/source, notes.

`planned` nghĩa xếp đủ mục tiêu số điểm/ngày và các địa điểm bắt buộc; không đồng nghĩa mọi giờ mở cửa đều đã biết. `partial` nghĩa không đủ điểm phù hợp hoặc không xếp vừa, không tự nới điều kiện. Khi chủ động bỏ một điểm mà không thay, lịch có thể thành partial so với stops_per_day ban đầu. Lịch rỗng không được mô tả là chuyến đi hoàn chỉnh.

Giờ chưa biết hoặc thời lượng mặc định được ghi ở notes. Mặc định 60 phút/Attraction, 45 phút/Restaurant khi không có dữ liệu. Giới hạn thời gian/km được kiểm tra trên ma trận đang sử dụng; nếu routing estimated thì không được xem là kiểm chứng quãng đường thực tế.

### 3. Cung cấp giờ mở cửa có cấu trúc

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

### 4. Chỉnh một ngày

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

### 5. Hội thoại nhiều lượt

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

Hội thoại lưu bền vững trong SQLite (tối đa 40 message gần nhất); backend nên gửi tuần tự cho cùng conversation_id. Endpoint này tập trung vào lập/chỉnh lịch. Endpoint chat chung `/api/v1/chat` điều phối thêm tìm địa điểm, hỏi thông tin du lịch và trò chuyện cơ bản như mô tả ở phần Chatbot.

### 6. LLM tùy chọn

Đặt GEMINI_API_KEY và GEMINI_MODEL trong .env, khởi động lại container để env được nạp, rồi gửi use_llm:true. Không có model mặc định được tự chọn hoặc tự phát sinh chi phí. Adapter dùng Gemini generateContent với JSON Schema và Pydantic validation; chỉ trích yêu cầu, không sinh place_id, lộ trình hay giờ mở cửa. Địa điểm và giờ trong kết quả luôn do catalog/optimizer quyết định.

use_llm=true gửi message và context yêu cầu đến Gemini. Không cấu hình hoặc phản hồi LLM không hợp lệ trả 503; backend có thể chọn thử lại với use_llm:false. Không để LLM thực thi code/tool tùy ý; các công cụ Search/Recommendation/Routing được orchestration cố định trong Python. Chưa dùng LangGraph hoặc vòng lặp LLM tự chọn tool; intent router và các workflow quyết định nhánh xử lý trong Python.

### 7. Routing tùy chọn

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

### 8. Kiểm tra lại và vận hành

GET validation đối chiếu catalog hiện tại: tồn tại/active, tọa độ thay đổi, giờ mở cửa đã biết, khung ngày/nghỉ, thứ tự thời gian, trùng điểm, các ID bắt buộc. valid kiểm tra các ràng buộc được kiểm chứng; complete riêng biệt cho biết đạt mục tiêu lịch hay chưa. Status invalid/incomplete/valid_with_assumptions/valid_against_catalog; không thay thế kiểm tra tình trạng hoạt động/giao thông thực tế.

Candidate pool tối đa 80 địa điểm, greedy insertion ưu tiên required rồi mức phù hợp trừ chi phí di chuyển; 2-opt chỉ nhận thay đổi vẫn thỏa toàn bộ kiểm tra lịch. Không có bảo đảm tìm được phương án nếu tồn tại phương án tối ưu khác; có thể partial vì heuristic. Không tạo địa điểm giả nếu thiếu catalog. Chưa có OR-Tools/VRP, đặt chỗ, giá hay đa thành phố.

Đặt API sau backend đã xác thực người dùng. Service API key không phải tài khoản end-user; backend phải lấy user_id từ phiên đăng nhập, tránh cho client tự chọn user_id người khác. SQLite/volume hiện có giữ trips và trip_conversations; không xóa volume khi cần giữ lịch. Dùng GET để khôi phục lịch; dữ liệu hội thoại/lịch cần chính sách lưu/xóa ở tầng backend khi đưa lên production.

Kiểm thử:

```powershell
python -m unittest discover -s tests -v
```

Tests dùng embedding giả và Qdrant in-memory. Gemini/OSRM được mock hoặc tắt, không gọi dịch vụ trả phí. Kiểm thử logic không chứng minh chất lượng gợi ý/đường đi ngoài thực tế.

Nguồn tích hợp: [OSRM Table API](https://project-osrm.org/docs/v5.24.0/api/#table-service), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).


## Indexing từ backend

Luồng RabbitMQ/outbox, upload S3 và bảng đo thời gian được mô tả tập trung trong [README gốc](../README.md#indexing). AI nhận lệnh nội bộ `POST /api/v1/indexing/apply`, yêu cầu service key; hỗ trợ revision, tombstone, retry và trả `timings_ms`. Các API embedding cũ không có revision, chỉ dùng cho dữ liệu ngoài backend. Chạy một API process trên SQLite hiện tại; không tăng replicas trước khi bổ sung coordination dùng chung.
