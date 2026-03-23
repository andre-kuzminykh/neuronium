from __future__ import annotations
from pathlib import Path
from typing import Optional
import git
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.persistence.db import get_db
from backend.persistence.models import FileLink as FileLinkModel
from backend.domain.schemas import (
    ConnectLocalRequest, ConnectRemoteRequest, RepoInfo, FileNode,
    FileContent, FileSaveRequest, FileCreateRequest,
    FileLinkCreate, FileLinkInfo, SearchResult, SearchMatch,
)
from backend.services.repo_service import repo_service
from backend.services.file_service import file_service
from backend.utils.file_types import is_binary_file

router = APIRouter(prefix="/repo", tags=["repository"])


# ─── Git request schemas ─────────────────────────────────────────────────────

class GitCommitRequest(BaseModel):
    repo_id: int
    message: str
    files: Optional[list[str]] = None  # None = all changed files


class GitPushRequest(BaseModel):
    repo_id: int


class GitStatusFile(BaseModel):
    path: str
    status: str  # "modified", "added", "deleted", "untracked"


class GitStatusResponse(BaseModel):
    branch: str
    changed_files: list[GitStatusFile]
    has_remote: bool


@router.get("/info", response_model=RepoInfo)
async def get_repo_info(repo_id: int, db: AsyncSession = Depends(get_db)):
    """Get repository info by ID (used to restore session)."""
    try:
        repo = await repo_service.get_repo(db, repo_id)
        if not Path(repo.path).exists():
            raise HTTPException(status_code=404, detail="Repository path no longer exists on disk")
        return RepoInfo(id=repo.id, path=repo.path, name=repo.name, is_remote=repo.is_remote)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


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


# ─── File Links ───────────────────────────────────────────────────────────────

@router.post("/file-links", response_model=FileLinkInfo)
async def create_file_link(req: FileLinkCreate, db: AsyncSession = Depends(get_db)):
    """Store a markdown link relationship inserted by drag-and-drop."""
    try:
        link = FileLinkModel(
            repo_id=req.repo_id,
            source_file=req.source_file,
            target_file=req.target_file,
            position_start=req.position_start,
            link_text=req.link_text,
        )
        db.add(link)
        await db.commit()
        await db.refresh(link)
        return FileLinkInfo(
            id=link.id, repo_id=link.repo_id,
            source_file=link.source_file, target_file=link.target_file,
            position_start=link.position_start, link_text=link.link_text,
            created_at=link.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/file-links", response_model=list[FileLinkInfo])
async def get_file_links(
    repo_id: int,
    source_file: Optional[str] = None,
    target_file: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get file link relationships. Filter by source or target file."""
    query = select(FileLinkModel).where(FileLinkModel.repo_id == repo_id)
    if source_file:
        query = query.where(FileLinkModel.source_file == source_file)
    if target_file:
        query = query.where(FileLinkModel.target_file == target_file)
    result = await db.execute(query.order_by(FileLinkModel.created_at.desc()))
    links = result.scalars().all()
    return [
        FileLinkInfo(
            id=l.id, repo_id=l.repo_id,
            source_file=l.source_file, target_file=l.target_file,
            position_start=l.position_start, link_text=l.link_text,
            created_at=l.created_at,
        )
        for l in links
    ]


# ─── Search ───────────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[SearchResult])
async def search_files(
    repo_id: int,
    query: str,
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across all text files in the repository."""
    repo = await repo_service.get_repo(db, repo_id)
    base = Path(repo.path)
    results: list[SearchResult] = []
    q = query.lower()

    for file_path in sorted(base.rglob("*")):
        if not file_path.is_file():
            continue
        if any(part.startswith(".") for part in file_path.parts):
            continue
        if is_binary_file(str(file_path)):
            continue
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            if q not in content.lower():
                continue
            matches = [
                SearchMatch(line=i + 1, text=line.strip())
                for i, line in enumerate(content.splitlines())
                if q in line.lower()
            ][:5]
            if matches:
                results.append(SearchResult(
                    path=str(file_path.relative_to(base)),
                    matches=matches,
                ))
        except Exception:
            continue
        if len(results) >= 20:
            break

    return results


# ─── Git Operations ──────────────────────────────────────────────────────────

@router.get("/git/status", response_model=GitStatusResponse)
async def git_status(repo_id: int, db: AsyncSession = Depends(get_db)):
    """Get git status of the repository."""
    try:
        repo_model = await repo_service.get_repo(db, repo_id)
        repo = git.Repo(repo_model.path)
    except (FileNotFoundError, git.InvalidGitRepositoryError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    changed: list[GitStatusFile] = []

    # Modified/staged files
    for item in repo.index.diff(None):
        changed.append(GitStatusFile(path=item.a_path, status="modified"))
    for item in repo.index.diff("HEAD"):
        changed.append(GitStatusFile(path=item.a_path, status="staged"))

    # Untracked files
    for path in repo.untracked_files:
        changed.append(GitStatusFile(path=path, status="untracked"))

    # Deleted
    for item in repo.index.diff(None).iter_change_type("D"):
        # already handled above, skip duplicates
        pass

    branch = repo.active_branch.name if not repo.head.is_detached else "HEAD"
    has_remote = len(repo.remotes) > 0

    return GitStatusResponse(branch=branch, changed_files=changed, has_remote=has_remote)


@router.post("/git/commit")
async def git_commit(req: GitCommitRequest, db: AsyncSession = Depends(get_db)):
    """Commit changes to git."""
    try:
        repo_model = await repo_service.get_repo(db, req.repo_id)
        repo = git.Repo(repo_model.path)
    except (FileNotFoundError, git.InvalidGitRepositoryError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        if req.files:
            repo.index.add(req.files)
        else:
            # Add all changed and untracked files
            repo.git.add(A=True)

        if not repo.index.diff("HEAD") and not repo.untracked_files:
            raise HTTPException(status_code=400, detail="Nothing to commit")

        commit = repo.index.commit(req.message)
        return {"status": "ok", "commit_sha": str(commit.hexsha)[:8], "message": req.message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/git/push")
async def git_push(req: GitPushRequest, db: AsyncSession = Depends(get_db)):
    """Push commits to remote."""
    try:
        repo_model = await repo_service.get_repo(db, req.repo_id)
        repo = git.Repo(repo_model.path)
    except (FileNotFoundError, git.InvalidGitRepositoryError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not repo.remotes:
        raise HTTPException(status_code=400, detail="No remote configured")

    try:
        origin = repo.remotes.origin
        push_info = origin.push()
        errors = [p.summary for p in push_info if p.flags & p.ERROR]
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
