from app.core.config import env
"""Validate the supplied tourism workbook, then optionally send idempotent API batches."""
import argparse
import json
import math
import os
import sys
import time
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.modules.recommendation.schemas import PlaceData, ReviewData

LOCAL_TIME = timezone(timedelta(hours=7))


def clean(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    value = unicodedata.normalize("NFC", value).replace("\u00a0", " ").strip() if isinstance(value, str) else value
    return None if value == "" else value


def tags(value):
    return list(dict.fromkeys(s.strip() for s in str(value).split(";") if s.strip())) if value else []


def boolean(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    v = str(value).casefold().strip()
    if v in ("có", "true", "1", "yes"):
        return True
    if v in ("không", "false", "0", "no"):
        return False
    raise ValueError("Giá trị Phù hợp gia đình chưa được nhận diện")


def records(sheet):
    rows = sheet.iter_rows(values_only=True)
    headers = [h.strip() if isinstance(h,str) else h for h in next(rows)]
    # The current workbook has an empty header for the address column.
    if sheet.title == "Địa điểm chung" and len(headers) > 4 and not headers[4]:
        headers[4] = "Địa chỉ"
    for number, row in enumerate(rows, 2):
        if any(v is not None for v in row):
            yield number, {h: clean(v) for h,v in zip(headers, row) if h}


def load_data(path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    places, reviews, errors = [], [], []
    try:
        seen = set()
        for number, row in records(workbook["Địa điểm chung"]):
            try:
                pid = str(row["Mã địa điểm"])
                if pid in seen:
                    raise ValueError("Trùng Mã địa điểm")
                seen.add(pid)
                p = PlaceData(place_id=pid, name=row["Tên địa điểm"], place_type=row["Loại địa điểm"],
                    city=row["Thành phố"], address=row.get("Địa chỉ") or row.get("Unnamed: 4"),
                    latitude=row.get("Vĩ độ"), longitude=row.get("Kinh độ"), description=row.get("Mô tả"),
                    categories=tags(row.get("Danh mục")), amenities=tags(row.get("Tiện ích và đặc điểm")),
                    tags=tags(row.get("Thẻ sở thích")), travel_styles=tags(row.get("Phong cách du lịch")),
                    rating=row.get("Điểm đánh giá"), review_count=row.get("Số lượt đánh giá") or 0,
                    budget=row.get("Mức ngân sách"), family_friendly=boolean(row.get("Phù hợp gia đình")),
                    duration_minutes=row.get("Thời lượng tham quan dự kiến (phút)"),
                    opening_hours=row.get("Giờ mở cửa"), suitable_time=row.get("Thời điểm tham quan phù hợp"),
                    closed_days=row.get("Ngày đóng cửa"), review_summary=row.get("Tóm tắt đánh giá"),
                    image_url=row.get("Liên kết ảnh đại diện"),
                    image_urls=list(dict.fromkeys(x.strip() for x in str(row.get("Liên kết tất cả ảnh") or "").splitlines() if x.strip())),
                    image_count=row.get("Số lượng ảnh"), data_status=row.get("Trạng thái dữ liệu"),
                    popularity_score=row.get("Điểm phổ biến"), ai_cluster_id=row.get("Mã cụm AI"),
                    source_embedding_status=row.get("Trạng thái embedding"))
                places.append(p)
            except (ValueError, TypeError, KeyError) as exc:
                errors.append({"sheet": "Địa điểm chung", "row": number, "error": str(exc)})
        place_ids = {p.place_id for p in places}
        seen_reviews = set()
        for number, row in records(workbook["Đánh giá (Reviews)"]):
            try:
                date = row["Ngày đánh giá"]
                if isinstance(date, (int, float)):
                    date = from_excel(date, workbook.epoch)
                elif isinstance(date, str):
                    date = datetime.fromisoformat(date)
                if not isinstance(date, datetime):
                    raise ValueError("Ngày đánh giá không phải datetime hợp lệ")
                if date.tzinfo is None:
                    date = date.replace(tzinfo=LOCAL_TIME)
                review = ReviewData(review_id=str(row["Mã đánh giá"]), place_id=str(row["Mã địa điểm"]),
                    rating=row["Điểm đánh giá"], text=row["Nội dung đánh giá"],
                    normalized_text=row.get("Nội dung chuẩn hóa (Embedding)"), occurred_at=date,
                    use_for_embedding=boolean(row.get("Dùng cho embedding")) is True,
                    cleaning_version="review-clean-v1" if "Dùng cho embedding" in row else None)
                if review.place_id not in place_ids:
                    raise ValueError("Review không liên kết tới địa điểm hợp lệ")
                if review.review_id in seen_reviews:
                    raise ValueError("Trùng Mã đánh giá")
                seen_reviews.add(review.review_id)
                reviews.append(review)
            except (ValueError, TypeError, KeyError) as exc:
                errors.append({"sheet": "Đánh giá (Reviews)", "row": number, "error": str(exc)})
    finally:
        workbook.close()
    return places, reviews, errors


def post(base, endpoint, key, items, api_key, timeout=1800):
    request = Request(base.rstrip("/") + "/api/v1/" + endpoint,
        data=json.dumps({key: [x.model_dump(mode="json") for x in items]}, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", **({"X-API-Key": api_key} if api_key else {})}, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8')}") from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--base-url", default="http://localhost:9000")
    parser.add_argument("--send", action="store_true", help="Without this flag, validate only")
    parser.add_argument("--skip-invalid", action="store_true")
    parser.add_argument("--batch-size", type=int, default=10, choices=range(1, 101), metavar="1-100")
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--places-only", action="store_true", help="Index places without importing reviews")
    args = parser.parse_args()
    if args.timeout <= 0 or args.retries < 0:
        parser.error("timeout must be positive and retries must be non-negative")
    places, reviews, errors = load_data(args.workbook)
    print(json.dumps({"valid_places": len(places), "valid_reviews": len(reviews), "invalid_rows": len(errors),
                      "errors": errors[:20]}, ensure_ascii=False))
    if errors and not args.skip_invalid:
        print("Import aborted: fix invalid rows or explicitly use --skip-invalid", file=sys.stderr)
        return 1
    if args.send:
        batches = [("places/batch", "places", places)]
        if not args.places_only:
            batches.append(("reviews/batch", "reviews", reviews))
        for endpoint, key, items in batches:
            for start in range(0, len(items), args.batch_size):
                for attempt in range(args.retries + 1):
                    try:
                        result = post(args.base_url, endpoint, key, items[start:start+args.batch_size],
                                      env("RECOMMENDATION_API_KEY", ""), args.timeout)
                        break
                    except (TimeoutError, URLError, ConnectionError):
                        if attempt == args.retries:
                            raise
                        print(json.dumps({"endpoint": endpoint, "offset": start, "retry": attempt+1}), flush=True)
                        time.sleep(2)
                print(json.dumps({"endpoint": endpoint, "processed": min(start+args.batch_size, len(items)),
                    "total": len(items),
                    "pending_index": result.get("pending_index", result.get("places", {}).get("pending_index", 0))}), flush=True)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
