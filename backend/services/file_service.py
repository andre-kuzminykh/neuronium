from pathlib import Path
import aiofiles

from backend.config import settings
from backend.domain.schemas import FileContent
from backend.utils.path_security import resolve_safe_path
from backend.utils.file_types import is_text_file, is_binary_file, get_language


class FileService:
    async def read_file(self, repo_path: str, rel_path: str) -> FileContent:
        base = Path(repo_path).resolve()
        file_path = resolve_safe_path(base, rel_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {rel_path}")
        if not file_path.is_file():
            raise ValueError(f"Not a file: {rel_path}")

        size = file_path.stat().st_size
        if size > settings.max_file_size_bytes:
            raise ValueError(f"File too large: {size} bytes (max {settings.max_file_size_bytes})")

        if is_binary_file(str(file_path)):
            return FileContent(path=rel_path, content="", size=size, is_binary=True)

        try:
            async with aiofiles.open(str(file_path), "r", encoding="utf-8") as f:
                content = await f.read()
        except UnicodeDecodeError:
            try:
                async with aiofiles.open(str(file_path), "r", encoding="latin-1") as f:
                    content = await f.read()
            except Exception:
                return FileContent(path=rel_path, content="", size=size, is_binary=True)

        return FileContent(path=rel_path, content=content, encoding="utf-8", size=size)

    async def write_file(self, repo_path: str, rel_path: str, content: str) -> None:
        base = Path(repo_path).resolve()
        file_path = resolve_safe_path(base, rel_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {rel_path}")

        async with aiofiles.open(str(file_path), "w", encoding="utf-8") as f:
            await f.write(content)

    async def create_file(self, repo_path: str, rel_path: str, content: str = "") -> None:
        base = Path(repo_path).resolve()
        file_path = resolve_safe_path(base, rel_path)

        if file_path.exists():
            raise ValueError(f"File already exists: {rel_path}")

        file_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(str(file_path), "w", encoding="utf-8") as f:
            await f.write(content)

    async def get_file_stat(self, repo_path: str, rel_path: str) -> dict:
        base = Path(repo_path).resolve()
        file_path = resolve_safe_path(base, rel_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {rel_path}")
        stat = file_path.stat()
        return {
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "is_binary": is_binary_file(str(file_path)),
            "language": get_language(rel_path),
        }


file_service = FileService()
