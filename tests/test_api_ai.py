"""
API integration tests: /ai and /session endpoints.
FR-07/08/09/10/11/12/13/14: AI chat, suggestions, accept/reject, model selector, session.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch


# Helper to mock the AI provider
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
        """FR-13: Each model must have id, name, provider."""
        resp = await client.get("/ai/models")
        for model in resp.json():
            assert "id" in model
            assert "name" in model
            assert "provider" in model


class TestAiExecution:
    """FR-09/10: AI command on selection/file, result as suggestion (not silent write)."""

    @pytest.mark.asyncio
    async def test_execute_returns_suggestion(self, client):
        """FR-10: AI must return a suggestion object, never silently write."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("Rewritten content")
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
        assert data["id"] is not None
        assert data["status"] == "pending"  # NOT silently applied
        assert data["result_text"] == "Rewritten content"
        assert data["model_name"] == "gpt-4o-mini"
        assert data["command_text"] == "Rewrite"

    @pytest.mark.asyncio
    async def test_execute_with_selection(self, client):
        """FR-09: AI must operate on selected text."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("Selected and rewritten")
            resp = await client.post("/ai/execute", json={
                "instruction": "Clean up wording",
                "file_path": "notes.txt",
                "file_type": "txt",
                "selected_text": "Some messy notes here.",
                "selection_start": 0,
                "selection_end": 22,
                "scope": "selection",
                "model": "gpt-4o-mini",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["scope"] == "selection"
        assert data["selection_start"] == 0
        assert data["selection_end"] == 22

    @pytest.mark.asyncio
    async def test_execute_records_diff(self, client):
        """FR-10: Suggestion must include a diff."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("New content")
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
    async def test_execute_latency_recorded(self, client):
        """NFR-PERF: AI execution must record latency."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("result")
            resp = await client.post("/ai/execute", json={
                "instruction": "Summarize",
                "full_file_content": "content",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })
        data = resp.json()
        assert data["latency_ms"] is not None
        assert data["latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_execute_with_attached_files(self, client):
        """FR-09: AI must accept attached context files."""
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("result with context")
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


class TestAiAcceptReject:
    """FR-11: User must be able to Accept or Reject AI suggestions."""

    @pytest.fixture
    async def suggestion(self, client):
        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("AI result text")
            resp = await client.post("/ai/execute", json={
                "instruction": "Rewrite",
                "full_file_content": "original",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })
        return resp.json()

    @pytest.mark.asyncio
    async def test_reject_suggestion(self, client, suggestion):
        """FR-11: User can reject a suggestion — file must NOT be modified."""
        resp = await client.post("/ai/reject", json={"suggestion_id": suggestion["id"]})
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_ai_history_recorded(self, client, suggestion):
        """FR: AI command history must be accessible in session."""
        resp = await client.get("/ai/history")
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.json()]
        assert suggestion["id"] in ids

    @pytest.mark.asyncio
    async def test_accept_applies_to_file(self, client, tmp_repo):
        """FR-11: Accept must write result to the actual file."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()

        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("# Accepted content")
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
    async def test_create_file_from_result(self, client, tmp_repo):
        """FR-12: User can create a new file from AI result."""
        repo = (await client.post("/repo/connect-local", json={"path": str(tmp_repo)})).json()

        with patch("backend.services.model_router.ModelRouter.get_provider") as mock_get:
            mock_get.return_value = mock_provider("# Brand new document")
            suggestion = (await client.post("/ai/execute", json={
                "instruction": "Create draft",
                "scope": "full_file",
                "model": "gpt-4o-mini",
            })).json()

        resp = await client.post(
            f"/ai/create-file-from-result?repo_id={repo['id']}",
            json={"suggestion_id": suggestion["id"], "new_file_path": "drafts/new.md"},
        )
        assert resp.status_code == 200
        assert (tmp_repo / "drafts" / "new.md").exists()
        assert "Brand new document" in (tmp_repo / "drafts" / "new.md").read_text()


class TestSession:
    """FR-14: Session must persist and restore."""

    @pytest.mark.asyncio
    async def test_get_default_session(self, client):
        resp = await client.get("/session/state")
        assert resp.status_code == 200
        data = resp.json()
        assert "open_tabs" in data
        assert "ai_panel_open" in data

    @pytest.mark.asyncio
    async def test_save_and_restore_session(self, client):
        state = {
            "active_repo_id": 1,
            "open_tabs": ["README.md", "notes.txt"],
            "active_tab": "README.md",
            "selected_model": "gpt-4o",
            "ai_panel_open": True,
            "file_modes": {"README.md": "edit", "notes.txt": "view"},
        }
        save_resp = await client.post("/session/state", json=state)
        assert save_resp.status_code == 200

        get_resp = await client.get("/session/state")
        restored = get_resp.json()
        assert restored["open_tabs"] == ["README.md", "notes.txt"]
        assert restored["selected_model"] == "gpt-4o"
        assert restored["file_modes"]["README.md"] == "edit"

    @pytest.mark.asyncio
    async def test_session_ai_panel_mode(self, client):
        """FR: AI panel open/collapsed state must persist."""
        await client.post("/session/state", json={"ai_panel_open": False, "open_tabs": [], "file_modes": {}})
        resp = await client.get("/session/state")
        assert resp.json()["ai_panel_open"] is False


class TestAutomations:
    """FR (foundation): Automation templates must be creatable and runnable."""

    @pytest.mark.asyncio
    async def test_create_automation_template(self, client):
        resp = await client.post("/automations/", json={
            "name": "Rewrite all",
            "instruction": "Rewrite in professional tone",
            "scope": "full_file",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is not None
        assert data["name"] == "Rewrite all"

    @pytest.mark.asyncio
    async def test_list_automations(self, client):
        await client.post("/automations/", json={"name": "T1", "instruction": "Do X", "scope": "full_file"})
        resp = await client.get("/automations/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_run_automation(self, client):
        template = (await client.post("/automations/", json={
            "name": "Run me",
            "instruction": "Summarize",
            "scope": "full_file",
        })).json()

        resp = await client.post("/automations/run", json={
            "template_id": template["id"],
            "file_paths": ["README.md", "notes.txt"],
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    @pytest.mark.asyncio
    async def test_automation_history(self, client):
        template = (await client.post("/automations/", json={
            "name": "History test",
            "instruction": "Do something",
            "scope": "full_file",
        })).json()
        await client.post("/automations/run", json={
            "template_id": template["id"],
            "file_paths": ["README.md"],
        })
        resp = await client.get("/automations/history")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestHealth:
    """NFR: Health endpoint must be available."""

    @pytest.mark.asyncio
    async def test_health_ok(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
