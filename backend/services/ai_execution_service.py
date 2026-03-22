from __future__ import annotations
from typing import Optional
import uuid
import time
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from backend.domain.schemas import AiExecuteRequest, AiSuggestion
from backend.domain.enums import SuggestionStatus
from backend.persistence.models import AiCommand
from backend.services.model_router import model_router
from backend.utils.diff_utils import compute_unified_diff


class AiExecutionService:
    async def execute(self, db: AsyncSession, request: AiExecuteRequest) -> AiSuggestion:
        model_id = request.model or "gpt-4o-mini"
        provider = model_router.get_provider(model_id)

        original_text = request.selected_text or request.full_file_content or ""

        start_time = time.time()
        result_text = await provider.generate(
            instruction=request.instruction,
            content=original_text,
            file_path=request.file_path,
            file_type=request.file_type,
            attached_files=[(f.path, f.content) for f in request.attached_files],
        )
        latency_ms = int((time.time() - start_time) * 1000)

        diff = compute_unified_diff(original_text, result_text, request.file_path or "")

        suggestion_id = str(uuid.uuid4())

        # Persist to DB
        cmd = AiCommand(
            id=suggestion_id,
            file_path=request.file_path,
            scope=request.scope.value,
            instruction=request.instruction,
            original_text=original_text,
            result_text=result_text,
            diff=diff,
            status=SuggestionStatus.PENDING.value,
            model_name=model_id,
            latency_ms=latency_ms,
            selection_start=request.selection_start,
            selection_end=request.selection_end,
        )
        db.add(cmd)
        await db.commit()

        return AiSuggestion(
            id=suggestion_id,
            file_path=request.file_path,
            scope=request.scope,
            selection_start=request.selection_start,
            selection_end=request.selection_end,
            original_text=original_text,
            result_text=result_text,
            diff=diff,
            status=SuggestionStatus.PENDING,
            created_at=datetime.now(timezone.utc),
            model_name=model_id,
            command_text=request.instruction,
            latency_ms=latency_ms,
        )

    async def get_history(self, db: AsyncSession, repo_id: Optional[int] = None, limit: int = 50) -> list[AiSuggestion]:
        from sqlalchemy import select

        query = select(AiCommand).order_by(AiCommand.created_at.desc()).limit(limit)
        result = await db.execute(query)
        commands = result.scalars().all()

        return [
            AiSuggestion(
                id=cmd.id,
                file_path=cmd.file_path,
                scope=cmd.scope,
                selection_start=cmd.selection_start,
                selection_end=cmd.selection_end,
                original_text=cmd.original_text,
                result_text=cmd.result_text or "",
                diff=cmd.diff,
                status=cmd.status,
                created_at=cmd.created_at,
                model_name=cmd.model_name,
                command_text=cmd.instruction,
                latency_ms=cmd.latency_ms,
            )
            for cmd in commands
        ]


ai_execution_service = AiExecutionService()
