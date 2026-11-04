from app.core.config import env
"""Trusted-config OSRM table adapter; estimates are labelled and never replace no-route pairs."""
import json
import math
import os
from urllib.request import urlopen
from urllib.parse import urlsplit
from fastapi import HTTPException
from app.modules.recommendation.hybrid_service import distance_km


class RouteMatrix:
    def build(self, locations, transport, allow_estimates=True):
        base = env(f"TRIP_OSRM_{transport.upper()}_URL")
        if transport == "driving":
            base = base or env("TRIP_OSRM_URL")
        if base:
            if urlsplit(base).scheme not in ("http", "https"):
                raise ValueError("Routing URL phải dùng http hoặc https")
            # Configure one server per transport; the server's extract profile determines actual mode.
            profile = {"driving":"driving", "walking":"foot", "cycling":"bike"}[transport]
            coords = ";".join(f"{p['longitude']},{p['latitude']}" for p in locations)
            try:
                with urlopen(f"{base.rstrip('/')}/table/v1/{profile}/{coords}?annotations=duration,distance", timeout=15) as response:
                    raw = response.read(4_000_001)
                if len(raw) > 4_000_000:
                    raise ValueError("Routing response quá lớn")
                data = json.loads(raw)
                n = len(locations)
                if data.get("code") != "Ok":
                    raise ValueError("Routing provider không trả Ok")
                for key in ("durations", "distances"):
                    matrix = data[key]
                    if len(matrix) != n or any(len(row) != n for row in matrix):
                        raise ValueError("Routing matrix sai kích thước")
                    if any(v is not None and (not math.isfinite(v) or v < 0) for row in matrix for v in row):
                        raise ValueError("Routing matrix không hợp lệ")
                return {"source":"osrm", "estimated":False, "transport":transport,
                    "minutes":[[v/60 if v is not None else None for v in row] for row in data["durations"]],
                    "kilometers":[[v/1000 if v is not None else None for v in row] for row in data["distances"]],
                    "warnings":["Thời gian đường bộ từ routing provider, không bao gồm giao thông thời gian thực"]}
            except Exception as exc:
                if not allow_estimates:
                    raise HTTPException(503, "Routing provider lỗi và ước tính đã bị tắt") from exc
                warning = "Routing provider lỗi; dùng ước tính hình học cho toàn bộ ma trận"
        else:
            if not allow_estimates:
                raise HTTPException(503, "Chưa cấu hình routing đường bộ cho phương tiện này")
            warning = "Chưa có routing đường bộ; khoảng cách/thời gian là ước tính, không xác minh đường đi hoặc giao thông"
        speed = {"driving":25.0, "walking":4.5, "cycling":12.0}[transport]
        factor = 1.15 if transport == "walking" else 1.3
        distances = [[distance_km(a["latitude"],a["longitude"],b["latitude"],b["longitude"])*factor for b in locations] for a in locations]
        return {"source":"haversine_estimate", "estimated":True, "transport":transport,
                "minutes":[[v/speed*60 for v in row] for row in distances], "kilometers":distances,
                "assumed_speed_kmh":speed, "distance_multiplier":factor, "warnings":[warning]}
