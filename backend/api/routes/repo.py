from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.persistence.db import get_db
from backend.domain.schemas import (
    ConnectLocalRequest, ConnectRemoteRequest, RepoInfo, FileNode,
    FileContent, FileSaveRequest, FileCreateRequest,
)
from backend.services.repo_service import repo_service
from backend.services.file_service import file_service

router = APIRouter(prefix="/repo", tags=["repository"])


@router.post("/connect-local", response_model=RepoInfo)
async def connect_local(req: ConnectLocalRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await repo_service.connect_local(db, req.path)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/connect-remote", response_model=RepoInfo)
async def connect_remote(req: ConnectRemoteRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await repo_service.connect_remote(db, req.url, req.name)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tree", response_model=list[FileNode])
async def get_tree(repo_id: int, path: str = "", db: AsyncSession = Depends(get_db)):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        return repo_service.get_tree(repo.path, path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/file", response_model=FileContent)
async def get_file(repo_id: int, path: str, db: AsyncSession = Depends(get_db)):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        return await file_service.read_file(repo.path, path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/file")
async def save_file(repo_id: int, req: FileSaveRequest, db: AsyncSession = Depends(get_db)):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        await file_service.write_file(repo.path, req.path, req.content)
        return {"status": "ok"}
    except (FileNotFoundError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/file/create")
async def create_file(repo_id: int, req: FileCreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        repo = await repo_service.get_repo(db, repo_id)
        await file_service.create_file(repo.path, req.path, req.content)
        return {"status": "ok"}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
