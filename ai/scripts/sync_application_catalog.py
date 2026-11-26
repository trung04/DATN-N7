"""Copy the public local application catalog to the local AI index by place UUID."""

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from dotenv import dotenv_values


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def local_origin(value):
    url = urlsplit(value)
    if (
        url.scheme not in {"http", "https"}
        or url.hostname not in {"localhost", "127.0.0.1", "::1"}
        or url.username
        or url.password
        or url.path not in {"", "/"}
        or url.query
        or url.fragment
    ):
        raise argparse.ArgumentTypeError("Use a loopback origin without a path.")
    return value.rstrip("/")


def request(opener, base, path, key=None, data=None):
    headers = {"Accept": "application/json"}
    if key:
        headers["X-API-Key"] = key
    body = None
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    with opener.open(Request(base + "/api/v1/" + path, body, headers), timeout=180) as result:
        return json.load(result)


def pages(opener, backend, resource, **filters):
    page = 1
    while True:
        query = urlencode({"page": page, "limit": 100, "sortBy": "name", "sortOrder": "ASC", **filters})
        result = request(opener, backend, f"{resource}?{query}")
        yield result["data"]
        if page * result["meta"]["limit"] >= result["meta"]["total"]:
            return
        page += 1


def catalog_place(detail, hotel_ids):
    categories = detail["categories"]
    codes = {category["code"] for category in categories}
    place_type = "Attraction"
    if detail["id"] in hotel_ids:
        place_type = "Hotel"
    elif "RESTAURANT" in codes:
        place_type = "Restaurant"
    return {
        "place_id": detail["id"],
        "name": detail["name"],
        "place_type": place_type,
        "city": detail["city"],
        "address": detail["address"],
        "description": detail["description"],
        "latitude": detail["latitude"],
        "longitude": detail["longitude"],
        "categories": [category["name"] for category in categories],
        "tags": detail["tags"],
        "rating": detail["averageRating"] if 1 <= detail["averageRating"] <= 5 else None,
        "review_count": detail["reviewCount"],
        "duration_minutes": detail["estimatedVisitDurationMinutes"],
        "opening_hours": (detail["openingHours"] or {}).get("display"),
        "image_url": detail["primaryImageUrl"],
    }


def linked_hotels(opener, backend):
    try:
        return {
            hotel["placeId"]
            for batch in pages(opener, backend, "hotels")
            for hotel in batch
            if hotel.get("placeId")
        }
    except HTTPError as error:
        if error.code < 500:
            raise
        print(f"Hotel catalog unavailable (HTTP {error.code}); syncing places only.", file=sys.stderr)
        return set()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="http://127.0.0.1:3000", type=local_origin)
    parser.add_argument("--ai", default="http://127.0.0.1:9000", type=local_origin)
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--city", required=True)
    args = parser.parse_args()
    values = dotenv_values(args.env_file)
    key = values.get("AI_SERVICE_API_KEY") or values.get("RECOMMENDATION_API_KEY")
    if not key:
        parser.error("Set AI_SERVICE_API_KEY or RECOMMENDATION_API_KEY in the specified local env file.")

    opener = build_opener(NoRedirect())
    hotel_ids = linked_hotels(opener, args.backend)
    saved = pending = 0
    for batch in pages(opener, args.backend, "places", city=args.city):
        places = [
            catalog_place(request(opener, args.backend, f"places/{row['id']}"), hotel_ids)
            for row in batch
            if row["status"] == "ACTIVE" and row["city"]
        ]
        if not places:
            continue
        result = request(opener, args.ai, "places/batch", key, {"places": places})
        saved += result["saved"]
        pending += result["pending_index"]
    if not saved or pending:
        parser.exit(1, f"AI catalog incomplete. Saved {saved}, pending index {pending}.\n")
    print(f"Saved and indexed {saved} places for {args.city}.")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f"Local catalog sync failed with HTTP {error.code} on {urlsplit(error.url).path}.") from None
    except URLError:
        raise SystemExit("Could not connect to the local backend or local AI service.") from None
