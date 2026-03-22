from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.persistence.models import AutomationTemplate as AutomationTemplateModel, AutomationRun
from backend.domain.schemas import AutomationTemplate


class AutomationService:
    async def list_templates(self, db: AsyncSession) -> list[AutomationTemplate]:
        result = await db.execute(select(AutomationTemplateModel))
        templates = result.scalars().all()
        return [
            AutomationTemplate(
                id=t.id, name=t.name, instruction=t.instruction,
                scope=t.scope, model=t.model
            )
            for t in templates
        ]

    async def create_template(self, db: AsyncSession, template: AutomationTemplate) -> AutomationTemplate:
        model = AutomationTemplateModel(
            name=template.name,
            instruction=template.instruction,
            scope=template.scope,
            model=template.model,
        )
        db.add(model)
        await db.commit()
        await db.refresh(model)
        template.id = model.id
        return template

    async def run_template(self, db: AsyncSession, template_id: int, file_paths: list[str]) -> int:
        result = await db.execute(
            select(AutomationTemplateModel).where(AutomationTemplateModel.id == template_id)
        )
        template = result.scalar_one_or_none()
        if not template:
            raise FileNotFoundError(f"Template not found: {template_id}")

        run = AutomationRun(
            template_id=template_id,
            file_paths=file_paths,
            status="completed",
            result_summary=f"Ran on {len(file_paths)} files",
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return run.id

    async def get_history(self, db: AsyncSession, limit: int = 50) -> list[dict]:
        result = await db.execute(
            select(AutomationRun).order_by(AutomationRun.created_at.desc()).limit(limit)
        )
        runs = result.scalars().all()
        return [
            {
                "id": r.id,
                "template_id": r.template_id,
                "file_paths": r.file_paths,
                "status": r.status,
                "result_summary": r.result_summary,
                "created_at": str(r.created_at),
            }
            for r in runs
        ]


automation_service = AutomationService()
