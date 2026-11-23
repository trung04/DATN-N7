from app.core.timing import measure
"""Versioned internal indexing commands. One API process owns the local AI catalog."""
import hashlib
import json
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from qdrant_client import models
from app.core.auth import authorize
from app.modules.recommendation.schemas import Contract, Identifier, PlaceData
from .schemas import ImageEmbeddingRequest

router = APIRouter(prefix="/api/v1/indexing", tags=["Internal indexing"], dependencies=[Depends(authorize)])

class IndexCommand(Contract):
    kind: Literal["TEXT_UPSERT", "TEXT_DELETE", "IMAGE_UPSERT", "IMAGE_DELETE"]
    resource_id: Identifier
    place_id: Identifier
    revision: int = Field(gt=0)
    place: PlaceData | None = None
    image: ImageEmbeddingRequest | None = None
    content_hash: str | None = Field(None, pattern=r"^[a-f0-9]{64}$")

@router.post("/apply")
def apply(command: IndexCommand, request: Request):
    svc = request.app.state.recommendation
    images = request.app.state.image_search
    resource = ("TEXT:" if command.kind.startswith("TEXT") else "IMAGE:") + command.resource_id
    # Serialize check + side effects + completion. Retries recover a persisted pending intent.
    timings = {}
    with svc.lock:
        with svc.store.connection() as db:
            db.execute("CREATE TABLE IF NOT EXISTS indexing_versions (resource TEXT PRIMARY KEY,revision INTEGER NOT NULL,kind TEXT NOT NULL,result TEXT)")
            old = db.execute("SELECT revision,kind,result FROM indexing_versions WHERE resource=?", (resource,)).fetchone()
            if old and old[0] > command.revision:
                return {"status": "SUPERSEDED", "revision": old[0]}
            if old and old[0] == command.revision and old[2]:
                return {**json.loads(old[2]), "timings_ms": {}, "replayed": True}
            if command.kind.startswith("IMAGE") and command.kind.endswith("UPSERT"):
                parent = db.execute("SELECT revision,kind FROM indexing_versions WHERE resource=?", ("TEXT:" + command.place_id,)).fetchone()
                if parent and parent[1] == "TEXT_DELETE" and parent[0] >= command.revision:
                    return {"status": "SUPERSEDED", "revision": parent[0]}
        if command.kind == "TEXT_UPSERT" and (command.place is None or command.place.place_id != command.resource_id or command.place_id != command.resource_id):
            raise ValueError("TEXT_UPSERT requires matching place identifiers")
        if command.kind == "IMAGE_UPSERT":
            if command.image is None or not command.image.index or command.image.image_id != command.resource_id or command.image.place_id != command.place_id:
                raise ValueError("IMAGE_UPSERT requires matching indexed image identifiers")
            from .image_search import decode_image
            import base64
            # Validate all inputs even when a hash says this image was processed previously.
            with measure(timings, "PREPROCESS"):
                checked = decode_image(command.image.image_base64)
            if min(checked.size) < 224:
                checked.close()
                raise ValueError("Indexing image short edge must be at least 224 pixels")
            checked.close()
            encoded = command.image.image_base64.partition(",")[2] if command.image.image_base64.startswith("data:") else command.image.image_base64
            actual_hash = hashlib.sha256(base64.b64decode(encoded, validate=True)).hexdigest()
            if command.content_hash != actual_hash:
                raise ValueError("Image checksum mismatch")
        with svc.store.connection() as db:
            db.execute("INSERT INTO indexing_versions VALUES(?,?,?,NULL) ON CONFLICT(resource) DO UPDATE SET revision=excluded.revision,kind=excluded.kind,result=NULL",
                       (resource, command.revision, command.kind))
        result = {"status": "SUCCEEDED", "revision": command.revision, "indexed": True, "timings_ms": timings}
        if command.kind == "TEXT_UPSERT":
            item = svc.upsert_places([command.place], return_embeddings=True, timings=timings)["items"][0]
            if not item["indexed"]:
                raise HTTPException(503, "Text index pending; retry command")
            result.update({k: item[k] for k in ("model", "dimensions", "content_hash", "reused_embedding", "point_id")})
        elif command.kind == "TEXT_DELETE":
            if svc.content.qdrant.collection_exists(svc.content.collection):
                with measure(timings, "QDRANT_WRITE"):
                    svc.content.qdrant.delete(svc.content.collection, models.PointIdsList(points=[svc.content.point_id(command.resource_id)]), wait=True)
            with svc.store.connection() as db:
                row = db.execute("SELECT data FROM places WHERE id=?", (command.resource_id,)).fetchone()
                if row:
                    data = json.loads(row[0]); data["active"] = False
                    db.execute("UPDATE places SET data=?,indexed=0 WHERE id=?", (json.dumps(data, ensure_ascii=False), command.resource_id))
        else:
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "tourism-image:" + command.resource_id))
            if command.kind == "IMAGE_DELETE":
                if images.qdrant.collection_exists(images.collection):
                    with measure(timings, "QDRANT_WRITE"):
                        images.qdrant.delete(images.collection, models.PointIdsList(points=[point_id]), wait=True)
            else:
                images.ensure_collection()
                found = images.qdrant.retrieve(images.collection, ids=[point_id], with_payload=True)
                payload = found[0].payload if found else {}
                reused = payload.get("content_hash") == command.content_hash and payload.get("model") == images.model_key
                if not reused:
                    item = images.embed(command.image, timings=timings)
                    result.update(model=item.model, dimensions=item.dimensions)
                else:
                    result.update(model=images.encoder.model_name, dimensions=images.encoder.dimensions)
                with measure(timings, "QDRANT_WRITE"):
                    images.qdrant.set_payload(images.collection, {
                        "content_hash": command.content_hash, "revision": command.revision,
                        "alt_text": command.image.alt_text, "is_primary": command.image.is_primary,
                        "image_url": command.image.image_url,
                        "city": command.image.city.casefold() if command.image.city else None,
                        "place_type": command.image.place_type,
                    }, points=[point_id], wait=True)
                result.update(reused_embedding=reused, content_hash=command.content_hash, point_id=point_id)
        with svc.store.connection() as db:
            db.execute("UPDATE indexing_versions SET result=? WHERE resource=? AND revision=?", (json.dumps(result), resource, command.revision))
        return result
