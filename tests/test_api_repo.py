"""
API integration tests: /repo endpoints.
FR-01: Connect local repo
FR-02: Connect remote repo (clone)
FR-03: Display file tree
FR-04/05/06: Open, edit, save files
"""
from __future__ import annotations

import pytest


class TestConnectLocalRepo:
    """FR-01: User must be able to connect a local Git repository."""

    @pytest.mark.asyncio
    async def test_connect_local_success(self, client, tmp_repo):
        resp = await client.post("/repo/connect-local", json={"path": str(tmp_repo)})
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is not None
        assert data["path"] == str(tmp_repo)
        assert data["is_remote"] is False

    @pytest.mark.asyncio
    async def test_connect_local_bad_path(self, client):
        resp = await client.post("/repo/connect-local", json={"path": "/does/not/exist"})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_connect_local_idempotent(self, client, tmp_repo):
        resp1 = await client.post("/repo/connect-local", json={"path": str(tmp_repo)})
        resp2 = await client.post("/repo/connect-local", json={"path": str(tmp_repo)})
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json()["id"] == resp2.json()["id"]


class TestFileTree:
    """FR-03: Left panel must display file tree of connected repo."""

    @pytest.mark.asyncio
    async def test_get_tree(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/tree?repo_id={repo['id']}")
        assert resp.status_code == 200
        names = [n["name"] for n in resp.json()]
        assert "README.md" in names
        assert "notes.txt" in names
        assert "subdir" in names

    @pytest.mark.asyncio
    async def test_tree_hides_hidden_files(self, client, tmp_repo):
        (tmp_repo / ".hidden").write_text("secret")
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/tree?repo_id={repo['id']}")
        names = [n["name"] for n in resp.json()]
        assert ".hidden" not in names

    @pytest.mark.asyncio
    async def test_tree_nested_dir_has_children(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/tree?repo_id={repo['id']}")
        subdir = next(n for n in resp.json() if n["name"] == "subdir")
        assert subdir["is_dir"] is True
        assert any(c["name"] == "file.py" for c in subdir["children"])

    @pytest.mark.asyncio
    async def test_tree_nonexistent_repo(self, client):
        resp = await client.get("/repo/tree?repo_id=9999")
        assert resp.status_code == 404


class TestFileOperations:
    """FR-04/05/06: Open files in tabs, edit, and save."""

    @pytest.mark.asyncio
    async def test_get_file_content(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/file?repo_id={repo['id']}&path=README.md")
        assert resp.status_code == 200
        data = resp.json()
        assert "Test Repo" in data["content"]
        assert data["is_binary"] is False

    @pytest.mark.asyncio
    async def test_get_missing_file(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/file?repo_id={repo['id']}&path=missing.md")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_binary_file_flagged(self, client, tmp_repo):
        """FR: Binary files must be flagged, not returned as text."""
        (tmp_repo / "data.bin").write_bytes(b"\x00\x01binary")
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/file?repo_id={repo['id']}&path=data.bin")
        assert resp.status_code == 200
        assert resp.json()["is_binary"] is True

    @pytest.mark.asyncio
    async def test_save_file(self, client, tmp_repo):
        """FR-06: User must be able to save edited files."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        new_content = "# Updated README\n\nNew content."
        resp = await client.put(
            f"/repo/file?repo_id={repo['id']}",
            json={"path": "README.md", "content": new_content},
        )
        assert resp.status_code == 200
        # Verify it was actually written to disk
        assert (tmp_repo / "README.md").read_text() == new_content

    @pytest.mark.asyncio
    async def test_save_nonexistent_file(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.put(
            f"/repo/file?repo_id={repo['id']}",
            json={"path": "ghost.md", "content": "content"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_new_file(self, client, tmp_repo):
        """FR: Create new file in repository."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.post(
            f"/repo/file/create?repo_id={repo['id']}",
            json={"path": "new_doc.md", "content": "# New Document"},
        )
        assert resp.status_code == 200
        assert (tmp_repo / "new_doc.md").exists()

    @pytest.mark.asyncio
    async def test_path_traversal_in_file_read(self, client, tmp_repo):
        """NFR-SEC-01: Path traversal in file read must be blocked."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/file?repo_id={repo['id']}&path=../../etc/passwd")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_path_traversal_in_file_save(self, client, tmp_repo):
        """NFR-SEC-01: Path traversal in file write must be blocked."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.put(
            f"/repo/file?repo_id={repo['id']}",
            json={"path": "../../evil.txt", "content": "pwned"},
        )
        assert resp.status_code == 400
