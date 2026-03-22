import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.persistence.db import init_db
from backend.api.routes import repo, session, ai, automations, health

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("neuronium")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Neuronium backend...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down Neuronium backend")


app = FastAPI(
    title="Neuronium",
    description="Local-first AI workspace IDE backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repo.router)
app.include_router(session.router)
app.include_router(ai.router)
app.include_router(automations.router)
app.include_router(health.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.backend_host, port=settings.backend_port, reload=True)
