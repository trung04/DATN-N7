import logging
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.auth import authorize
from app.core.config import env
from app.modules.semantic_search.router import router as semantic_router
from app.modules.recommendation.router import router as recommendation_router
from app.modules.trip_planner.router import router as trip_router
from app.workflows.chat_workflow import ChatWorkflow,UnifiedChatRequest

router=APIRouter()
router.include_router(semantic_router)
router.include_router(recommendation_router)
router.include_router(trip_router)
logger=logging.getLogger(__name__)

@router.get("/demo",include_in_schema=False)
def demo_page():
    return FileResponse(Path(__file__).resolve().parents[1]/"static"/"demo.html",media_type="text/html",
        headers={"Cache-Control":"no-store"})

@router.get("/health")
def health(request: Request):
    model=request.app.state.embedding
    return {"status":"healthy","model":model.model_name,"device":model.device,"dimensions":model.dimensions}

@router.get("/ready")
def ready(request: Request):
    try:request.app.state.qdrant.get_collections()
    except Exception:raise HTTPException(503,"Qdrant chưa sẵn sàng; recommendation có thể dùng local fallback")
    return {"status":"ready","pending_index":request.app.state.recommendation.status()["pending_index"]}

@router.get("/qdrant/collection-info")
def collection_info(request: Request):
    try:
        collection=env("QDRANT_COLLECTION_NAME","documents_bge_m3")
        info=request.app.state.qdrant.get_collection(collection)
        return {"collection_name":collection,"status":info.status,"points_count":info.points_count,"vectors":info.config.params.vectors}
    except Exception:
        logger.exception("Không thể lấy thông tin collection")
        raise HTTPException(500,"Không thể lấy thông tin collection từ Qdrant")

@router.post("/api/v1/chat",dependencies=[Depends(authorize)],tags=["Travel assistant"])
def chat(body: UnifiedChatRequest,request: Request):
    return ChatWorkflow(request.app.state.recommendation).run(body)
