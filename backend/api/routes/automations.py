from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.persistence.db import get_db
from backend.domain.schemas import AutomationTemplate, AutomationRunRequest
from backend.services.automation_service import automation_service

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get("/", response_model=list[AutomationTemplate])
async def list_automations(db: AsyncSession = Depends(get_db)):
    return await automation_service.list_templates(db)


@router.post("/", response_model=AutomationTemplate)
async def create_automation(template: AutomationTemplate, db: AsyncSession = Depends(get_db)):
    return await automation_service.create_template(db, template)


@router.post("/run")
async def run_automation(req: AutomationRunRequest, db: AsyncSession = Depends(get_db)):
    try:
        run_id = await automation_service.run_template(db, req.template_id, req.file_paths)
        return {"run_id": run_id, "status": "completed"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/history")
async def get_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await automation_service.get_history(db, limit)
