# CLIP image embeddings for the search engine

Collection riêng `tourism_images_clip_v1`, named vector `image_dense`, 512 chiều, cosine. Model mặc định `openai/clip-vit-base-patch32` qua Transformers. Vector chuẩn hóa L2; không so trực tiếp với vector BGE của địa điểm. Một ảnh là một point, payload có `place_id` để search engine lấy chi tiết địa điểm từ backend. Nhiều ảnh có thể liên kết cùng địa điểm.

## Backend nạp ảnh

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

## Tìm ảnh tương tự

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

## Collection và chạy dịch vụ

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
docker compose up -d --build ai-embedding-service
```

Swagger: http://localhost:9000/docs. API embedding ảnh hiện xử lý từng ảnh; backend có thể gửi lần lượt, chưa có image batch; đã hỗ trợ multipart upload theo hướng dẫn dưới đây.

Nguồn triển khai: [CLIP model card](https://huggingface.co/openai/clip-vit-base-patch32), [Transformers CLIP API](https://huggingface.co/docs/transformers/model_doc/clip).


## Chọn file trực tiếp trong Swagger (không cần backend/base64)

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
