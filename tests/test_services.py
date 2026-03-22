"""
Service-level tests.
Covers: RepoService, FileService, SessionService, SuggestionService.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from pathlib import Path

from backend.services.repo_service import RepoService
from backend.services.file_service import FileService
from backend.services.session_service import SessionService
from backend.domain.schemas import SessionState
from backend.config import settings


# ─── RepoService ──────────────────────────────────────────────────────────────

class TestRepoService:
    """FR-01/02: Connect local and remote repos."""

    @pytest.mark.asyncio
    async def test_connect_local_repo(self, db_session, tmp_repo):
        svc = RepoService()
        info = await svc.connect_local(db_session, str(tmp_repo))
        assert info.id is not None
        assert info.path == str(tmp_repo)
        assert info.name == tmp_repo.name
        assert info.is_remote is False

    @pytest.mark.asyncio
    async def test_connect_local_idempotent(self, db_session, tmp_repo):
        """Connecting the same repo twice returns the same record."""
        svc = RepoService()
        info1 = await svc.connect_local(db_session, str(tmp_repo))
        info2 = await svc.connect_local(db_session, str(tmp_repo))
        assert info1.id == info2.id

    @pytest.mark.asyncio
    async def test_connect_local_missing_path(self, db_session):
        svc = RepoService()
        with pytest.raises(FileNotFoundError):
            await svc.connect_local(db_session, "/nonexistent/path")

    @pytest.mark.asyncio
    async def test_connect_local_file_not_dir(self, db_session, tmp_repo):
        svc = RepoService()
        file_path = tmp_repo / "README.md"
        with pytest.raises(ValueError):
            await svc.connect_local(db_session, str(file_path))

    @pytest.mark.asyncio
    async def test_get_repo_not_found(self, db_session):
        svc = RepoService()
        with pytest.raises(FileNotFoundError):
            await svc.get_repo(db_session, 9999)

    def test_get_tree_basic(self, tmp_repo):
        """FR-03: File tree must display repo contents."""
        svc = RepoService()
        tree = svc.get_tree(str(tmp_repo))
        names = [n.name for n in tree]
        assert "README.md" in names
        assert "notes.txt" in names
        assert "subdir" in names

    def test_get_tree_hides_dotfiles(self, tmp_repo):
        """FR-03: Hidden files (.git etc.) must not appear in tree."""
        (tmp_repo / ".hidden").write_text("secret")
        svc = RepoService()
        tree = svc.get_tree(str(tmp_repo))
        names = [n.name for n in tree]
        assert ".hidden" not in names

    def test_get_tree_dirs_before_files(self, tmp_repo):
        """FR-03: Directories shown before files."""
        svc = RepoService()
        tree = svc.get_tree(str(tmp_repo))
        dir_indices = [i for i, n in enumerate(tree) if n.is_dir]
        file_indices = [i for i, n in enumerate(tree) if not n.is_dir]
        if dir_indices and file_indices:
            assert max(dir_indices) < max(file_indices) or min(dir_indices) < min(file_indices)

    def test_get_tree_subdirectory(self, tmp_repo):
        """FR-03: Nested files are accessible."""
        svc = RepoService()
        subtree = svc.get_tree(str(tmp_repo), "subdir")
        names = [n.name for n in subtree]
        assert "file.py" in names

    def test_get_tree_path_traversal_blocked(self, tmp_repo):
        """NFR-SEC-01: Tree must not traverse outside repo root."""
        svc = RepoService()
        with pytest.raises(PermissionError):
            svc.get_tree(str(tmp_repo), "../../etc")


# ─── FileService ──────────────────────────────────────────────────────────────

class TestFileService:
    """FR-04/05/06: Open files, edit, save."""

    @pytest.mark.asyncio
    async def test_read_text_file(self, tmp_repo):
        svc = FileService()
        content = await svc.read_file(str(tmp_repo), "README.md")
        assert content.path == "README.md"
        assert "Test Repo" in content.content
        assert content.is_binary is False

    @pytest.mark.asyncio
    async def test_read_missing_file_raises(self, tmp_repo):
        svc = FileService()
        with pytest.raises(FileNotFoundError):
            await svc.read_file(str(tmp_repo), "missing.md")

    @pytest.mark.asyncio
    async def test_read_binary_file(self, tmp_repo):
        """FR: Binary files must return is_binary=True, not raw content."""
        binary_path = tmp_repo / "data.bin"
        binary_path.write_bytes(b"\x00\x01\x02\x03binary")
        svc = FileService()
        content = await svc.read_file(str(tmp_repo), "data.bin")
        assert content.is_binary is True
        assert content.content == ""

    @pytest.mark.asyncio
    async def test_write_file(self, tmp_repo):
        """FR-06: Save file must persist content to disk."""
        svc = FileService()
        new_content = "# Updated\n\nNew content."
        await svc.write_file(str(tmp_repo), "README.md", new_content)
        result = await svc.read_file(str(tmp_repo), "README.md")
        assert result.content == new_content

    @pytest.mark.asyncio
    async def test_write_path_traversal_blocked(self, tmp_repo):
        """NFR-SEC-01: Write outside repo must be blocked."""
        svc = FileService()
        with pytest.raises(PermissionError):
            await svc.write_file(str(tmp_repo), "../../evil.txt", "pwned")

    @pytest.mark.asyncio
    async def test_create_file(self, tmp_repo):
        """FR: Create new file from AI result."""
        svc = FileService()
        await svc.create_file(str(tmp_repo), "new_file.md", "# New")
        assert (tmp_repo / "new_file.md").exists()
        assert (tmp_repo / "new_file.md").read_text() == "# New"

    @pytest.mark.asyncio
    async def test_create_file_already_exists_raises(self, tmp_repo):
        svc = FileService()
        with pytest.raises(ValueError):
            await svc.create_file(str(tmp_repo), "README.md", "duplicate")

    @pytest.mark.asyncio
    async def test_create_file_nested_path(self, tmp_repo):
        svc = FileService()
        await svc.create_file(str(tmp_repo), "deep/nested/file.md", "content")
        assert (tmp_repo / "deep" / "nested" / "file.md").exists()

    @pytest.mark.asyncio
    async def test_read_file_size_limit(self, tmp_repo):
        """NFR: Files exceeding size limit must be rejected."""
        big_file = tmp_repo / "big.txt"
        big_file.write_bytes(b"x" * (3 * 1024 * 1024))  # 3MB > 2MB limit
        svc = FileService()
        with pytest.raises(ValueError, match="too large"):
            await svc.read_file(str(tmp_repo), "big.txt")


# ─── SessionService ───────────────────────────────────────────────────────────

class TestSessionService:
    """FR-14: Session state must persist and restore across restarts."""

    @pytest.mark.asyncio
    async def test_get_state_default(self, db_session):
        svc = SessionService()
        state = await svc.get_state(db_session)
        assert isinstance(state, SessionState)
        assert state.active_repo_id is None
        assert state.open_tabs == []
        assert state.ai_panel_open is True

    @pytest.mark.asyncio
    async def test_save_and_restore_state(self, db_session):
        """FR-14: Saved session must be restorable."""
        svc = SessionService()
        state = SessionState(
            active_repo_id=42,
            open_tabs=["README.md", "notes.txt"],
            active_tab="README.md",
            selected_model="gpt-4o",
            ai_panel_open=False,
            file_modes={"README.md": "edit"},
        )
        await svc.save_state(db_session, state)
        restored = await svc.get_state(db_session)

        assert restored.active_repo_id == 42
        assert restored.open_tabs == ["README.md", "notes.txt"]
        assert restored.active_tab == "README.md"
        assert restored.selected_model == "gpt-4o"
        assert restored.ai_panel_open is False
        assert restored.file_modes["README.md"] == "edit"

    @pytest.mark.asyncio
    async def test_update_state(self, db_session):
        """FR-14: Session state must be updatable."""
        svc = SessionService()
        state1 = SessionState(selected_model="gpt-4o-mini")
        await svc.save_state(db_session, state1)

        state2 = SessionState(selected_model="gpt-4o", open_tabs=["file.py"])
        await svc.save_state(db_session, state2)

        restored = await svc.get_state(db_session)
        assert restored.selected_model == "gpt-4o"
        assert "file.py" in restored.open_tabs

    @pytest.mark.asyncio
    async def test_file_modes_per_tab(self, db_session):
        """FR: View/Edit mode must be stored per tab."""
        svc = SessionService()
        state = SessionState(
            open_tabs=["a.md", "b.py"],
            file_modes={"a.md": "view", "b.py": "edit"},
        )
        await svc.save_state(db_session, state)
        restored = await svc.get_state(db_session)
        assert restored.file_modes["a.md"] == "view"
        assert restored.file_modes["b.py"] == "edit"
