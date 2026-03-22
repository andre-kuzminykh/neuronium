from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.persistence.db import get_db
from backend.domain.schemas import SessionState
from backend.services.session_service import session_service

router = APIRouter(prefix="/session", tags=["session"])


@router.get("/state", response_model=SessionState)
async def get_state(db: AsyncSession = Depends(get_db)):
    return await session_service.get_state(db)


@router.post("/state")
async def save_state(state: SessionState, db: AsyncSession = Depends(get_db)):
    await session_service.save_state(db, state)
    return {"status": "ok"}
