from __future__ import annotations
from pathlib import Path
import git
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.config import settings
from backend.persistence.models import Repository
from backend.domain.schemas import RepoInfo, FileNode
from backend.utils.path_security import resolve_safe_path, is_within
from backend.utils.file_types import is_text_file


class RepoService:
    async def connect_local(self, db: AsyncSession, path: str) -> RepoInfo:
        abs_path = Path(path).resolve()
        if not abs_path.exists():
            raise FileNotFoundError(f"Path does not exist: {path}")
        if not abs_path.is_dir():
            raise ValueError(f"Path is not a directory: {path}")

        # Verify it's a git repo
        try:
            repo = git.Repo(str(abs_path))
            _ = repo.head
        except (git.InvalidGitRepositoryError, ValueError):
            # Not a git repo — that's ok for MVP, we'll just use the directory
            pass

        name = abs_path.name

        # Check if already registered
        result = await db.execute(
            select(Repository).where(Repository.path == str(abs_path))
        )
        existing = result.scalar_one_or_none()
        if existing:
            return RepoInfo(id=existing.id, path=existing.path, name=existing.name, is_remote=existing.is_remote)

        repo_model = Repository(name=name, path=str(abs_path), is_remote=False)
        db.add(repo_model)
        await db.commit()
        await db.refresh(repo_model)
        return RepoInfo(id=repo_model.id, path=repo_model.path, name=repo_model.name, is_remote=False)

    async def connect_remote(self, db: AsyncSession, url: str, name: str | None = None) -> RepoInfo:
        if not name:
            name = url.rstrip("/").split("/")[-1].replace(".git", "")

        clone_path = settings.workspace_path / name
        if clone_path.exists():
            raise ValueError(f"Directory already exists: {clone_path}")

        git.Repo.clone_from(url, str(clone_path))

        repo_model = Repository(name=name, path=str(clone_path), is_remote=True)
        db.add(repo_model)
        await db.commit()
        await db.refresh(repo_model)
        return RepoInfo(id=repo_model.id, path=repo_model.path, name=repo_model.name, is_remote=True)

    async def get_repo(self, db: AsyncSession, repo_id: int) -> Repository:
        result = await db.execute(select(Repository).where(Repository.id == repo_id))
        repo = result.scalar_one_or_none()
        if not repo:
            raise FileNotFoundError(f"Repository not found: {repo_id}")
        return repo

    def get_tree(self, repo_path: str, rel_path: str = "") -> list[FileNode]:
        base = Path(repo_path).resolve()
        target = resolve_safe_path(base, rel_path) if rel_path else base

        nodes = []
        try:
            entries = sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            return nodes

        for entry in entries:
            if entry.name.startswith("."):
                continue  # Skip hidden files/dirs like .git

            relative = str(entry.relative_to(base))
            if entry.is_dir():
                children = self.get_tree(repo_path, relative)
                nodes.append(FileNode(name=entry.name, path=relative, is_dir=True, children=children))
            else:
                nodes.append(FileNode(name=entry.name, path=relative, is_dir=False))
        return nodes


repo_service = RepoService()
