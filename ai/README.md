# AI service in DATN-N7

Mã AI nằm trong `ai/`, cùng một Git với `be/` và `fe/`. Chạy Docker từ thư mục gốc bằng `docker compose up -d --build`. Cấu hình Docker dùng `.env` ở gốc; không cần sao chép khóa vào mã nguồn hoặc frontend.

- AI API và Swagger: http://localhost:9000/docs
- Giao diện thử: http://localhost:9000/demo
- Backend gọi nội bộ: `http://ai:9000`, header `X-API-Key` dùng `AI_API_KEY` của backend (cùng `AI_SERVICE_API_KEY` trong root .env).
- Backend chỉ có scaffold; nghiệp vụ/end-user authorization chưa được triển khai. Không tự proxy tất cả AI endpoint ra public.

Các tài liệu module: [Recommendation](RECOMMENDATION.md), [tìm địa điểm](PLACE_SEARCH.md), [ảnh CLIP](IMAGE_SEARCH.md), [lịch trình](TRIP_PLANNER.md).

## Lưu trữ

SQLite AI ở `/app/data/recommendation.sqlite3`, Qdrant ở service `qdrant`, model cache ở `/root/.cache/huggingface`. Đây là các volume, không phải file cần commit. PostgreSQL của backend là kho riêng; việc hợp nhất Docker không tự chuyển SQLite sang PostgreSQL.

Collection chính `documents_bge_m3` / `dense`, vector factual `facts-v2`. CLIP dùng `tourism_images_clip_v1`. Sparse được giữ theo thiết kế collection nhưng Recommendation hiện dùng dense. Xem RECOMMENDATION.md để biết các giới hạn dữ liệu và đánh giá.

## Import và kiểm thử

Từ thư mục `ai/`, môi trường Python cài `requirements.txt` và `requirements-dev.txt`:

```bash
python -m unittest discover -s tests -q
python scripts/index_places.py /path/to/cleaned.xlsx
python scripts/index_places.py /path/to/cleaned.xlsx --send
```

Nếu chạy script trực tiếp trên host, đặt `RECOMMENDATION_API_KEY` trùng root `AI_SERVICE_API_KEY` trong môi trường hoặc một file `ai/.env` được Git ignore. `ai/.env.example` chỉ dành cho chạy native; Compose luôn dùng biến môi trường từ root.

Hợp đồng OpenAPI được lưu tại `contracts/openapi.json`; API runtime `/openapi.json` là bản tương ứng với mã đang chạy. Review được lưu riêng với cờ tuyển chọn; không ghép vào vector địa điểm. Dữ liệu Excel không đi kèm Git.
