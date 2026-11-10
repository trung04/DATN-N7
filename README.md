# DATN-N7 — Tourism App

Monorepo gồm `be/` (NestJS), `fe/` (frontend scaffold) và `ai/` (FastAPI: search, Recommendation, CLIP, trip planner). Một Git và một Docker Compose ở gốc; mỗi dịch vụ chạy container riêng.

## Khởi chạy

Cần Docker Desktop. Từ thư mục gốc:

```powershell
Copy-Item .env.example .env
# Sửa mật khẩu PostgreSQL và AI_SERVICE_API_KEY trong .env.
docker compose up -d --build
docker compose ps
```

Nếu đã có `.env` được cấu hình thì giữ nguyên, không sao chép đè. Không commit khóa hoặc đưa khóa vào frontend.

| Dịch vụ | Địa chỉ |
| --- | --- |
| AI demo | http://localhost:9000/demo |
| AI Swagger | http://localhost:9000/docs |
| AI readiness | http://localhost:9000/ready |
| Backend API | http://localhost:3000/api/v1 |
| Backend Swagger | http://localhost:3000/api/docs |
| Qdrant | http://localhost:6333/dashboard |

Backend NestJS từ `dev` đã có API nghiệp vụ, Swagger, đăng nhập mật khẩu/Google, session xoay vòng trên Redis và phân quyền theo vai trò/chủ sở hữu. Các module bao gồm địa điểm, khách sạn, phòng, tiện ích, người dùng, chủ khách sạn, lịch trình, điểm dừng, hoạt động, chính sách hủy và booking. Xem [backend README](be/README.md) cho hợp đồng API chi tiết.

Cấu hình tích hợp AI dùng nội bộ `http://ai:9000`, header `X-API-Key` lấy từ `AI_API_KEY`. Compose truyền cùng root `AI_SERVICE_API_KEY` cho hai dịch vụ; timeout được kiểm tra khi backend khởi động. Client nghiệp vụ gọi AI từ NestJS chưa được triển khai; demo AI gọi trực tiếp FastAPI.

## Database and Redis configuration

Backend dùng PostgreSQL/PostGIS của Compose và Redis; AI vẫn có catalog riêng. TypeORM tắt `synchronize` và không tự chạy migration. Sau khi cấu hình database, kiểm tra và chạy migration đã review từ thư mục `be/` bằng `npm run migration:show` và `npm run migration:run`. Không chạy migration lên dữ liệu cần giữ nếu chưa có backup.

Chạy backend trên host: dùng Node.js 24, tạo `be/.env` theo `be/.env.example`, khởi động hạ tầng bằng `docker compose up -d postgres redis`, rồi chạy `npm ci` và `npm run start:dev` trong `be/`. Trong Compose hiện tại backend chạy image production và được bật mặc định; frontend vẫn là profile tùy chọn.

Session đăng nhập dùng `AUTH_ACCESS_TTL_MS`, `AUTH_REFRESH_TTL_MS` và `FRONTEND_ORIGIN`. Google login chỉ bật khi có đủ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Booking và VNPAY Sandbox có các biến được kiểm tra tại startup; xem `be/README.md` và `be/src/config/environment.validation.ts`. Các cấu hình tùy chọn chưa truyền qua Compose có thể dùng khi chạy native hoặc được bổ sung vào môi trường dịch vụ khi triển khai.

PostgreSQL và Redis được publish trên loopback, mặc định lần lượt 5432 và 6379. Dịch vụ backend trong container dùng tên `postgres` và `redis`; chạy trên host dùng `localhost`. Redis cache dùng namespace `tourism:cache`, session dùng `tourism:auth`.

Recommendation hiện chạy **Content-based + Bayesian rating**: mặc định 75% nội dung BGE-M3 + 25% chất lượng rating/số lượt đánh giá; không có nhu cầu thì xếp theo chất lượng. Không dùng ItemKNN, lịch sử tương tác, điểm khoảng cách hoặc khám phá. Tọa độ vẫn dùng để lọc bán kính. Xem [luồng và công thức](ai/RECOMMENDATION_CONTENT_RATING.md).

Frontend upstream thiếu source, index.html, cấu hình TypeScript và lockfile nên chưa build được. Frontend nằm trong profile tùy chọn `frontend`, không bật mặc định; AI demo vẫn sử dụng được.

## Lưu trữ

AI dùng SQLite riêng tại `/app/data/recommendation.sqlite3`, không tự chuyển sang PostgreSQL của backend. Qdrant chính: `documents_bge_m3` / `dense`; ảnh: `tourism_images_clip_v1`. Dữ liệu, cache model và khóa không được đưa vào Git.

Trên máy đang tích hợp, root `.env` dùng lại volume cũ:

```dotenv
AI_VOLUMES_EXTERNAL=true
AI_DATA_VOLUME_NAME=newfolder5_recommendation-data
QDRANT_DATA_VOLUME_NAME=newfolder5_qdrant-data
HF_CACHE_VOLUME_NAME=embedding-cache
```

Phải dừng Qdrant cũ trước khi chạy Qdrant mới dùng chung volume. Không chạy hai Qdrant cùng một thư mục lưu trữ. Giữ backup SQLite/Qdrant trước khi thay đổi dữ liệu.

Máy mới dùng mặc định `AI_VOLUMES_EXTERNAL=false` từ template: Compose tạo volume riêng, chưa có dữ liệu. Import Excel đã làm sạch theo [AI README](ai/README.md). Lần đầu tải model có thể lâu. Không dùng `docker compose down -v` nếu cần giữ dữ liệu.

```powershell
docker compose logs --tail 100 ai backend
docker compose restart ai
docker compose down
```

Sau khi sửa mã, chạy lại `docker compose up -d --build`; cấu hình không bật reload hoặc mount source.

## Phát triển

Backend dùng Node.js 24. Trong `be/`: `npm ci`, `npm run lint`, `npm run build`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`. Đọc [AGENTS](be/AGENTS.md), [kiến trúc](be/rules/architecture.md), [REST](be/rules/rest-api.md) và [skill AI integration](be/skills/ai-service-integration/SKILL.md) trước khi thêm module.

AI: cài requirements.txt và requirements-dev.txt rồi từ `ai/` chạy `python -m unittest discover -s tests -q`. Xem [Recommendation](ai/RECOMMENDATION.md), [search](ai/PLACE_SEARCH.md), [CLIP](ai/IMAGE_SEARCH.md), [trip planner](ai/TRIP_PLANNER.md). Hợp đồng [OpenAPI](ai/contracts/openapi.json); runtime tại `/openapi.json`.

Root `.env` được bỏ khỏi Git index trong nhánh tích hợp, chỉ commit template placeholder. Việc này không xóa bí mật đã có trong lịch sử upstream; khóa từng chia sẻ cần được thay tại nơi cấp khóa.
