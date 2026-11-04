import base64
from fastapi import APIRouter, Depends, Request, Query, HTTPException, UploadFile, File, Form
from app.api.dependencies import service
from app.core.auth import authorize
from app.modules.recommendation.schemas import Identifier, PlaceData, PlaceBatch, ReviewBatch, PlaceEmbeddingResponse, PlaceEmbeddingBatchResponse
from .schemas import (PlaceSearchRequest,PlaceSearchResponse,ImageEmbeddingRequest,
    ImageEmbeddingResponse,ImageSearchRequest,TextEmbeddingRequest,TextEmbeddingResponse,
    BatchEmbeddingRequest,BatchEmbeddingResponse)
router=APIRouter(prefix="/api/v1",tags=["Semantic search"],dependencies=[Depends(authorize)])
@router.post("/embeddings/place", response_model=PlaceEmbeddingResponse, tags=["Place embeddings"])
def embed_place(body: PlaceData, svc=Depends(service)):
    """Backend sends a complete place. Build/reuse embedding, persist and upsert Qdrant.

    indexed=false means saved locally but awaiting Qdrant synchronization; retry reindex.
    This replaces the complete place record, so resend all fields that must be retained.
    """
    return svc.upsert_places([body], return_embeddings=True)["items"][0]

@router.post("/embeddings/places", response_model=PlaceEmbeddingBatchResponse, tags=["Place embeddings"])
def embed_places(body: PlaceBatch, svc=Depends(service)):
    """Embed and persist 1–100 complete places, returning the vector for each place."""
    return svc.upsert_places(body.places, return_embeddings=True)

@router.post("/places/batch")
def upsert_places(body: PlaceBatch, svc=Depends(service)):
    """Upsert by string place_id. Inspect pending_index; retry /recommendation/reindex if needed."""
    return svc.upsert_places(body.places)

@router.get("/places/{place_id}")
def get_place(place_id: Identifier, svc=Depends(service)):
    import json
    row = svc.store.place(place_id)
    return {"place": json.loads(row["data"]), "indexed": bool(row["indexed"]), "embedding_model": row["model"]}

@router.get("/places")
def list_places(city: str | None = None, place_type: str | None = None,
                offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100), svc=Depends(service)):
    import json
    places = [json.loads(r["data"]) for r in svc.store.places()]
    places = [p for p in places if p["active"] and (not city or p["city"].casefold() == city.casefold())
              and (not place_type or p["place_type"] == place_type)]
    return {"total": len(places), "offset": offset, "items": places[offset:offset+limit]}

@router.post("/reviews/batch")
def upsert_reviews(body: ReviewBatch, svc=Depends(service)):
    return svc.upsert_reviews(body.reviews)

@router.post("/embeddings/image", response_model=ImageEmbeddingResponse)
def image_embedding(body: ImageEmbeddingRequest, request: Request):
    return request.app.state.image_search.embed(body)


def uploaded_image_base64(file: UploadFile):
    """Bound the read; actual format and pixel limits are checked by the shared decoder."""
    try:
        content=file.file.read(8_000_001)
    finally:
        file.file.close()
    if len(content)>8_000_000:
        raise HTTPException(413,"Ảnh vượt giới hạn 8 MB")
    if not content:
        raise HTTPException(422,"File ảnh rỗng")
    return base64.b64encode(content).decode("ascii")


@router.post("/embeddings/image/upload",response_model=ImageEmbeddingResponse)
def upload_image_embedding(
    request: Request,
    file: UploadFile = File(...,description="Chọn ảnh JPEG, PNG hoặc WebP, tối đa 8 MB",json_schema_extra={"format":"binary"}),
    index: bool = Form(False,description="False: chỉ tạo vector; True: lưu Qdrant, cần image_id và place_id"),
    image_id: str | None = Form(None,max_length=128),
    place_id: str | None = Form(None,max_length=128),
    image_url: str | None = Form(None,max_length=5000),
    city: str | None = Form(None,max_length=200),
    place_type: str | None = Form(None,max_length=200),
):
    """Swagger: Try it out → Choose File → Execute. Default does not write to Qdrant."""
    body=ImageEmbeddingRequest(image_base64=uploaded_image_base64(file),index=index,
        image_id=image_id,place_id=place_id,image_url=image_url,city=city,place_type=place_type)
    return request.app.state.image_search.embed(body)


@router.post("/search/images/upload")
def upload_image_search(
    request: Request,
    file: UploadFile = File(...,description="Chọn ảnh để tìm ảnh tương tự, không lưu ảnh truy vấn",json_schema_extra={"format":"binary"}),
    city: str | None = Form(None,max_length=200),
    place_type: str | None = Form(None,max_length=200),
    limit: int = Form(10,ge=1,le=100),
):
    body=ImageSearchRequest(image_base64=uploaded_image_base64(file),city=city,place_type=place_type,limit=limit)
    return request.app.state.image_search.search(body)

@router.post("/search/images")
def image_search(body: ImageSearchRequest, request: Request):
    return request.app.state.image_search.search(body)

@router.get("/search/images/collection")
def image_collection(request: Request):
    service = request.app.state.image_search
    try:
        service.ensure_collection()
        count = service.qdrant.count(service.collection, exact=True).count
    except Exception as exc:
        raise HTTPException(503, "Collection ảnh chưa sẵn sàng") from exc
    return {"collection": service.collection, "vector_name": service.vector_name,
            "model": service.encoder.model_name, "dimensions": service.encoder.dimensions,
            "distance": "Cosine", "points_count": count}

@router.post("/search/places",response_model=PlaceSearchResponse)
def search_places(body: PlaceSearchRequest, request: Request):
    from app.agents.place_search_agent import PlaceSearchAgent
    return PlaceSearchAgent(request.app.state.recommendation).search(body)

@router.post("/embeddings/text",response_model=TextEmbeddingResponse)
def embed_text(body: TextEmbeddingRequest, request: Request):
    model=request.app.state.embedding
    try:
        return {"model":model.model_name,"dimensions":model.dimensions,"embedding":model.embed_text(body.text)}
    except ValueError as exc:
        raise HTTPException(400,str(exc))

@router.post("/embeddings/batch",response_model=BatchEmbeddingResponse)
def embed_batch(body: BatchEmbeddingRequest, request: Request):
    if len(body.text)>100:
        raise HTTPException(400,"Danh sách vượt quá 100 chuỗi")
    model=request.app.state.embedding
    try:
        return {"model":model.model_name,"dimensions":model.dimensions,"embeddings":model.embed_batch(body.text)}
    except ValueError as exc:
        raise HTTPException(400,str(exc))
