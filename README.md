# DATN-N7 — Tourism App

Monorepo gồm `be/` (NestJS), `fe/` (React + TypeScript) và `ai/` (FastAPI: search, Recommendation, CLIP, trip planner). Một Git và một Docker Compose ở gốc; mỗi dịch vụ chạy container riêng.

## Khởi chạy

Cần Docker Desktop. Từ thư mục gốc:

```powershell
Copy-Item .env.example .env
# Sửa mật khẩu PostgreSQL, AI_SERVICE_API_KEY và MINIO_ROOT_PASSWORD trong .env.
docker compose up -d --build
docker compose ps
```

Nếu đã có `.env` được cấu hình thì giữ nguyên, không sao chép đè. Không commit khóa hoặc đưa khóa vào frontend.

| Dịch vụ | Địa chỉ |
| --- | --- |
| Frontend | http://localhost:8080 |
| AI demo | http://localhost:9000/demo |
| AI Swagger | http://localhost:9000/docs |
| AI readiness | http://localhost:9000/ready |
| Backend API | http://localhost:3000/api/v1 |
| Backend Swagger | http://localhost:3000/api/docs |
| Qdrant | http://localhost:6333/dashboard |
| MinIO Console | http://localhost:9001 |
| MinIO S3 API | http://localhost:9002 |

Backend NestJS từ `dev` đã có API nghiệp vụ, Swagger, đăng nhập mật khẩu/Google, session xoay vòng trên Redis và phân quyền theo vai trò/chủ sở hữu. Các module bao gồm địa điểm, khách sạn, phòng, tiện ích, người dùng, chủ khách sạn, lịch trình, điểm dừng, hoạt động, chính sách hủy và booking. Xem [backend README](be/README.md) cho hợp đồng API chi tiết.

Cấu hình tích hợp AI dùng nội bộ `http://ai:9000`, header `X-API-Key` lấy từ `AI_API_KEY`. Compose truyền cùng root `AI_SERVICE_API_KEY` cho hai dịch vụ; timeout được kiểm tra khi backend khởi động. Client nghiệp vụ gọi AI từ NestJS chưa được triển khai; demo AI gọi trực tiếp FastAPI.

## Database and Redis configuration

Backend dùng PostgreSQL/PostGIS của Compose và Redis; AI vẫn có catalog riêng. TypeORM tắt `synchronize` và không tự chạy migration. Sau khi cấu hình database, kiểm tra và chạy migration đã review từ thư mục `be/` bằng `npm run migration:show` và `npm run migration:run`. Không chạy migration lên dữ liệu cần giữ nếu chưa có backup.

Chạy backend trên host: dùng Node.js 24, tạo `be/.env` theo `be/.env.example`, khởi động hạ tầng bằng `docker compose up -d postgres redis`, rồi chạy `npm ci` và `npm run start:dev` trong `be/`. Trong Compose hiện tại backend và frontend chạy image production và đều được bật mặc định.

Session đăng nhập dùng `AUTH_ACCESS_TTL_MS`, `AUTH_REFRESH_TTL_MS` và `FRONTEND_ORIGIN`. Google login chỉ bật khi có đủ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Booking và VNPAY Sandbox có các biến được kiểm tra tại startup; xem `be/README.md` và `be/src/config/environment.validation.ts`. Các cấu hình tùy chọn chưa truyền qua Compose có thể dùng khi chạy native hoặc được bổ sung vào môi trường dịch vụ khi triển khai.

PostgreSQL và Redis được publish trên loopback, mặc định lần lượt 5432 và 6379. Dịch vụ backend trong container dùng tên `postgres` và `redis`; chạy trên host dùng `localhost`. Redis cache dùng namespace `tourism:cache`, session dùng `tourism:auth`.

Recommendation hiện chạy **Content-based + Bayesian rating**: mặc định 75% nội dung BGE-M3 + 25% chất lượng rating/số lượt đánh giá; không có nhu cầu thì xếp theo chất lượng. Không dùng ItemKNN, lịch sử tương tác, điểm khoảng cách hoặc khám phá. Tọa độ vẫn dùng để lọc bán kính. Xem [luồng và công thức](ai/README.md#recommendation).

Frontend được build bằng Vite và phục vụ qua Nginx tại `http://localhost:8080`; đổi cổng bằng `FRONTEND_PORT` trong root `.env`. Nginx chuyển tiếp `/api/` đến `backend:3000` trong mạng Compose. Template `.env.example` dùng `VITE_DATA_MODE=api` và `VITE_API_BASE_URL=/api/v1` để đăng nhập và upload ảnh bằng backend thật. Nếu thay đổi các biến này, build lại frontend bằng `docker compose up -d --build frontend`. Chế độ `mock` chỉ dành cho dữ liệu demo và không tạo phiên đăng nhập backend.

## Lưu trữ

MinIO chạy mặc định cùng Compose, dùng volume `minio_data` tại `/data` để giữ bucket và file qua các lần khởi động lại. Cổng API trên host là `9002` để tránh trùng AI (`9000`); các container trong mạng Compose truy cập S3 qua `http://minio:9000`, region `us-east-1`. Đổi cổng bằng `MINIO_API_PORT` và `MINIO_CONSOLE_PORT` trong root `.env`.

Đăng nhập Console tại `http://localhost:9001` bằng `MINIO_ROOT_USER` và `MINIO_ROOT_PASSWORD` trong root `.env`. Backend nhận ảnh khách sạn qua `POST /api/v1/hotels/:hotelId/images` (multipart, trường `file`) và lưu vào bucket riêng `hotel-images`, tự tạo khi upload đầu tiên. Credentials S3 chỉ nằm ở backend; frontend gửi file đến backend bằng cookie đăng nhập. Chủ khách sạn mở **Khách sạn của tôi → Chi tiết / chỉnh sửa → Ảnh khách sạn** để tải, xem và xóa ảnh; quản trị viên có cùng chức năng trong trang chi tiết hotel. Cần tạo hồ sơ khách sạn trước khi thêm ảnh. Xem [hướng dẫn upload ảnh khách sạn](be/README.md#hotel-image-upload).

Image MinIO được build từ source release `RELEASE.2025-10-15T17-29-55Z` trong [Dockerfile](docker/minio/Dockerfile), theo [hướng dẫn phát hành chính thức](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z). MinIO Community đã chuyển sang phân phối mã nguồn và repository đã được lưu trữ; cấu hình này phục vụ phát triển local. Lần build đầu cần tải Go và các dependency nên có thể lâu; các lần sau dùng cache Docker.

```powershell
docker compose up -d --build minio
docker compose ps minio
docker compose logs --tail 50 minio
```

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

AI: cài requirements.txt và requirements-dev.txt rồi từ `ai/` chạy `python -m unittest discover -s tests -q`. Xem [Recommendation](ai/README.md#recommendation), [search](ai/README.md#tim-dia-diem), [CLIP](ai/README.md#tim-anh), [trip planner](ai/README.md#lich-trinh). Hợp đồng [OpenAPI](ai/contracts/openapi.json); runtime tại `/openapi.json`.

Root `.env` được bỏ khỏi Git index trong nhánh tích hợp, chỉ commit template placeholder. Việc này không xóa bí mật đã có trong lịch sử upstream; khóa từng chia sẻ cần được thay tại nơi cấp khóa.
