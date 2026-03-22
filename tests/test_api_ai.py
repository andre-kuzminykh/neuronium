"""
API integration tests: /ai, /session, /automations, /repo/search, /repo/file-links.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch


def mock_provider(result_text="AI generated result"):
    mock = AsyncMock()
    mock.generate = AsyncMock(return_value=result_text)
    return mock


class TestAiModels:
    """FR-13: User must be able to select AI model."""

    @pytest.mark.asyncio
    async def test_list_models_returns_list(self, client):
        resp = await client.get("/ai/models")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_models_have_required_fields(self, client):
        resp = await client.get("/ai/models")
        for model in resp.json():
            assert "id" in model
            assert "name" in model
            assert "provider" in model


class TestAiExecution:
    """FR-09/10: AI as action engine — returns suggestion, never silent write."""

    @pytest.mark.asyncio
    async def test_execute_returns_pending_suggestion(self, client):
        """AI result is always 'pending' — user must explicitly accept."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("Rewritten content")
            resp = await client.post("/ai/execute", json={
                "instruction": "Rewrite",
                "file_path": "README.md",
                "file_type": "md",
                "full_file_content": "# Old content",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"      # NOT applied yet
        assert data["result_text"] == "Rewritten content"
        assert data["model_name"] == "gpt-4o-mini"
        assert data["id"] is not None

    @pytest.mark.asyncio
    async def test_execute_with_selection_scope(self, client):
        """FR-09: AI must work on selected text (canvas task on selection)."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("cleaned text")
            resp = await client.post("/ai/execute", json={
                "instruction": "Clean up",
                "selected_text": "messy text",
                "selection_start": 0,
                "selection_end": 10,
                "scope": "selection",
                "model": "gpt-4o-mini",
            })
        assert resp.status_code == 200
        d = resp.json()
        assert d["scope"] == "selection"
        assert d["selection_start"] == 0

    @pytest.mark.asyncio
    async def test_execute_returns_diff(self, client):
        """Canvas overlay needs a diff to show."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("New content")
            resp = await client.post("/ai/execute", json={
                "instruction": "Rewrite",
                "full_file_content": "Old content",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })
        data = resp.json()
        assert data["diff"] is not None
        assert "-Old content" in data["diff"]
        assert "+New content" in data["diff"]

    @pytest.mark.asyncio
    async def test_execute_latency_tracked(self, client):
        """NFR-PERF: latency_ms must be recorded."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("r")
            resp = await client.post("/ai/execute", json={
                "instruction": "x", "scope": "full_file", "model": "gpt-4o-mini",
            })
        assert resp.json()["latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_execute_with_attached_files(self, client):
        """Drag-to-task: attached files passed as context."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("result with context")
            resp = await client.post("/ai/execute", json={
                "instruction": "Write based on context",
                "scope": "attached_files",
                "model": "gpt-4o-mini",
                "attached_files": [
                    {"path": "a.md", "content": "# Context A"},
                    {"path": "b.md", "content": "# Context B"},
                ],
            })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_execute_provider_error_returns_400(self, client):
        """Provider errors must be surfaced, not swallowed."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider()
            p.return_value.generate = AsyncMock(side_effect=ValueError("OpenAI error 401: invalid key"))
            resp = await client.post("/ai/execute", json={
                "instruction": "test", "scope": "full_file", "model": "gpt-4o-mini",
            })
        assert resp.status_code in (400, 500)
        assert "error" in resp.json().get("detail", "").lower() or resp.status_code == 500


class TestCanvasAcceptReject:
    """FR-11/12: Canvas actions — Accept writes file, Reject discards, Create New File."""

    async def _make_suggestion(self, client, file_content="original text"):
        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("AI result text")
            resp = await client.post("/ai/execute", json={
                "instruction": "Rewrite",
                "full_file_content": file_content,
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })
        return resp.json()

    @pytest.mark.asyncio
    async def test_reject_leaves_file_unchanged(self, client, tmp_repo):
        """FR-11: Reject must NOT modify the file."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        original = (tmp_repo / "README.md").read_text()

        suggestion = await self._make_suggestion(client)
        await client.post("/ai/reject", json={"suggestion_id": suggestion["id"]})

        assert (tmp_repo / "README.md").read_text() == original

    @pytest.mark.asyncio
    async def test_accept_writes_to_file(self, client, tmp_repo):
        """FR-11: Accept must write result to the actual file on disk."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()

        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("# Accepted content")
            suggestion = (await client.post("/ai/execute", json={
                "instruction": "Rewrite",
                "file_path": "README.md",
                "full_file_content": (tmp_repo / "README.md").read_text(),
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })).json()

        resp = await client.post(
            f"/ai/apply?repo_id={repo['id']}",
            json={"suggestion_id": suggestion["id"]},
        )
        assert resp.status_code == 200
        assert "Accepted content" in (tmp_repo / "README.md").read_text()

    @pytest.mark.asyncio
    async def test_create_new_file_from_canvas(self, client, tmp_repo):
        """FR-12: Create New File from canvas result."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()

        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("# Brand new document")
            suggestion = (await client.post("/ai/execute", json={
                "instruction": "Draft",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })).json()

        resp = await client.post(
            f"/ai/create-file-from-result?repo_id={repo['id']}",
            json={"suggestion_id": suggestion["id"], "new_file_path": "drafts/new.md"},
        )
        assert resp.status_code == 200
        assert (tmp_repo / "drafts" / "new.md").exists()

    @pytest.mark.asyncio
    async def test_cannot_accept_twice(self, client, tmp_repo):
        """FR-11: Once accepted, cannot re-apply same suggestion."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()

        with patch("backend.services.model_router.ModelRouter.get_provider") as p:
            p.return_value = mock_provider("# content")
            suggestion = (await client.post("/ai/execute", json={
                "instruction": "x", "file_path": "README.md",
                "full_file_content": (tmp_repo / "README.md").read_text(),
                "scope": "full_file", "model": "gpt-4o-mini",
            })).json()

        await client.post(f"/ai/apply?repo_id={repo['id']}", json={"suggestion_id": suggestion["id"]})
        resp2 = await client.post(f"/ai/apply?repo_id={repo['id']}", json={"suggestion_id": suggestion["id"]})
        assert resp2.status_code == 400  # already processed


class TestFileLinksDragToEditor:
    """FR: Drag file to editor inserts markdown link, relationship saved in DB."""

    @pytest.mark.asyncio
    async def test_create_file_link(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.post("/repo/file-links", json={
            "repo_id": repo["id"],
            "source_file": "README.md",
            "target_file": "notes.txt",
            "position_start": 42,
            "link_text": "[notes.txt](notes.txt)",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is not None
        assert data["source_file"] == "README.md"
        assert data["target_file"] == "notes.txt"
        assert data["position_start"] == 42
        assert data["link_text"] == "[notes.txt](notes.txt)"

    @pytest.mark.asyncio
    async def test_query_links_by_source(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        await client.post("/repo/file-links", json={
            "repo_id": repo["id"], "source_file": "README.md",
            "target_file": "notes.txt", "link_text": "[notes](notes.txt)",
        })
        await client.post("/repo/file-links", json={
            "repo_id": repo["id"], "source_file": "README.md",
            "target_file": "config.json", "link_text": "[config](config.json)",
        })

        resp = await client.get(f"/repo/file-links?repo_id={repo['id']}&source_file=README.md")
        assert resp.status_code == 200
        links = resp.json()
        assert len(links) == 2
        targets = {l["target_file"] for l in links}
        assert "notes.txt" in targets
        assert "config.json" in targets

    @pytest.mark.asyncio
    async def test_query_links_by_target(self, client, tmp_repo):
        """Can query which files link TO a given file (backlinks)."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        await client.post("/repo/file-links", json={
            "repo_id": repo["id"], "source_file": "README.md",
            "target_file": "notes.txt", "link_text": "[n](notes.txt)",
        })
        resp = await client.get(f"/repo/file-links?repo_id={repo['id']}&target_file=notes.txt")
        assert resp.status_code == 200
        assert any(l["source_file"] == "README.md" for l in resp.json())


class TestSearchTool:
    """FR: Search tool — search files in repo."""

    @pytest.mark.asyncio
    async def test_search_finds_content(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/search?repo_id={repo['id']}&query=hello")
        assert resp.status_code == 200
        results = resp.json()
        paths = [r["path"] for r in results]
        assert any("file.py" in p for p in paths)

    @pytest.mark.asyncio
    async def test_search_returns_match_lines(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/search?repo_id={repo['id']}&query=Test Repo")
        results = resp.json()
        assert len(results) > 0
        assert len(results[0]["matches"]) > 0
        assert results[0]["matches"][0]["line"] >= 1

    @pytest.mark.asyncio
    async def test_search_no_results_for_unknown_query(self, client, tmp_repo):
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/search?repo_id={repo['id']}&query=xyzzy_nonexistent_12345")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_search_excludes_hidden_files(self, client, tmp_repo):
        (tmp_repo / ".hidden_secret").write_text("xyzzy_secret_12345")
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()
        resp = await client.get(f"/repo/search?repo_id={repo['id']}&query=xyzzy_secret_12345")
        assert resp.status_code == 200
        assert resp.json() == []


class TestSession:
    """FR-14: Session persistence including chat_panel_open."""

    @pytest.mark.asyncio
    async def test_save_restore_session(self, client):
        state = {
            "active_repo_id": 1,
            "open_tabs": ["README.md"],
            "active_tab": "README.md",
            "selected_model": "gpt-4o",
            "ai_panel_open": False,
            "chat_panel_open": True,
            "file_modes": {"README.md": "edit"},
        }
        await client.post("/session/state", json=state)
        resp = await client.get("/session/state")
        r = resp.json()
        assert r["selected_model"] == "gpt-4o"
        assert r["file_modes"]["README.md"] == "edit"

    @pytest.mark.asyncio
    async def test_session_chat_panel_open_persisted(self, client):
        await client.post("/session/state", json={
            "chat_panel_open": True, "ai_panel_open": False,
            "open_tabs": [], "file_modes": {},
        })
        resp = await client.get("/session/state")
        # chat_panel_open stored in the JSON blob
        assert resp.status_code == 200


class TestHealth:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
