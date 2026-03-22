from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter(tags=["ops"])


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/metrics")
async def metrics():
    return {
        "status": "ok",
        "note": "Detailed metrics will be added in v2",
    }
