from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.persistence.models import AiCommand
from backend.domain.enums import SuggestionStatus
from backend.services.file_service import file_service


class SuggestionService:
    async def apply(self, db: AsyncSession, suggestion_id: str, repo_path: str) -> None:
        result = await db.execute(select(AiCommand).where(AiCommand.id == suggestion_id))
        cmd = result.scalar_one_or_none()
        if not cmd:
            raise FileNotFoundError(f"Suggestion not found: {suggestion_id}")
        if cmd.status != SuggestionStatus.PENDING.value:
            raise ValueError(f"Suggestion already processed: {cmd.status}")

        if cmd.file_path and cmd.result_text:
            # Read current file content
            current = await file_service.read_file(repo_path, cmd.file_path)

            if cmd.selection_start is not None and cmd.selection_end is not None:
                # Replace selection
                new_content = (
                    current.content[:cmd.selection_start]
                    + cmd.result_text
                    + current.content[cmd.selection_end:]
                )
            else:
                # Replace entire file content
                new_content = cmd.result_text

            await file_service.write_file(repo_path, cmd.file_path, new_content)

        cmd.status = SuggestionStatus.ACCEPTED.value
        await db.commit()

    async def reject(self, db: AsyncSession, suggestion_id: str) -> None:
        result = await db.execute(select(AiCommand).where(AiCommand.id == suggestion_id))
        cmd = result.scalar_one_or_none()
        if not cmd:
            raise FileNotFoundError(f"Suggestion not found: {suggestion_id}")

        cmd.status = SuggestionStatus.REJECTED.value
        await db.commit()

    async def create_file_from_result(
        self, db: AsyncSession, suggestion_id: str, repo_path: str, new_file_path: str
    ) -> None:
        result = await db.execute(select(AiCommand).where(AiCommand.id == suggestion_id))
        cmd = result.scalar_one_or_none()
        if not cmd:
            raise FileNotFoundError(f"Suggestion not found: {suggestion_id}")
        if not cmd.result_text:
            raise ValueError("No result text to create file from")

        await file_service.create_file(repo_path, new_file_path, cmd.result_text)
        cmd.status = SuggestionStatus.CREATED_FILE.value
        await db.commit()


suggestion_service = SuggestionService()
