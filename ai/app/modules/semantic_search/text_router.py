"""Text search and text embeddings; independent of image/demo routes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.auth import authorize
from .text_schemas import (PlaceSearchRequest, PlaceSearchResponse, TextEmbeddingRequest,
                      TextEmbeddingResponse, BatchEmbeddingRequest, BatchEmbeddingResponse)
from .text_search import PlaceSearchService

router=APIRouter(tags=["Text place search"],dependencies=[Depends(authorize)])

@router.post("/search/places",response_model=PlaceSearchResponse)
def search_places(body: PlaceSearchRequest, request: Request):
    return PlaceSearchService(request.app.state.recommendation).search(body)

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
