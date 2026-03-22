from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.persistence.db import get_db
from backend.domain.schemas import (
    AiExecuteRequest, AiSuggestion, AiApplyRequest,
    AiCreateFileRequest, ModelInfo,
)
from backend.services.ai_execution_service import ai_execution_service
from backend.services.suggestion_service import suggestion_service
from backend.services.model_router import model_router
from backend.services.repo_service import repo_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    models = model_router.list_available_models()
    return [ModelInfo(**m) for m in models]


@router.post("/execute", response_model=AiSuggestion)
async def execute(req: AiExecuteRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await ai_execution_service.execute(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply")
async def apply_suggestion(
    req: AiApplyRequest, repo_id: int, db: AsyncSession = Depends(get_db)
):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        await suggestion_service.apply(db, req.suggestion_id, repo.path)
        return {"status": "ok"}
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reject")
async def reject_suggestion(req: AiApplyRequest, db: AsyncSession = Depends(get_db)):
    try:
        await suggestion_service.reject(db, req.suggestion_id)
        return {"status": "ok"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/create-file-from-result")
async def create_file_from_result(
    req: AiCreateFileRequest, repo_id: int, db: AsyncSession = Depends(get_db)
):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        await suggestion_service.create_file_from_result(
            db, req.suggestion_id, repo.path, req.new_file_path
        )
        return {"status": "ok"}
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=list[AiSuggestion])
async def get_history(repo_id: int | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await ai_execution_service.get_history(db, repo_id, limit)
