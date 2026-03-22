from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from backend.persistence.models import Session
from backend.domain.schemas import SessionState


class SessionService:
    SESSION_KEY = "default"

    async def get_state(self, db: AsyncSession) -> SessionState:
        result = await db.execute(
            select(Session).where(Session.key == self.SESSION_KEY)
        )
        session = result.scalar_one_or_none()
        if not session:
            return SessionState()
        return SessionState(**session.state)

    async def save_state(self, db: AsyncSession, state: SessionState) -> None:
        result = await db.execute(
            select(Session).where(Session.key == self.SESSION_KEY)
        )
        session = result.scalar_one_or_none()
        if session:
            session.state = state.model_dump()
            session.updated_at = datetime.now(timezone.utc)
        else:
            session = Session(key=self.SESSION_KEY, state=state.model_dump())
            db.add(session)
        await db.commit()


session_service = SessionService()
