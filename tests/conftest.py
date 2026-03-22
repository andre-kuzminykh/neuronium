"""
Shared fixtures for all tests.
"""
from __future__ import annotations

import os
import tempfile
import pytest
import pytest_asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Use in-memory SQLite for tests
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

os.environ.setdefault("DATABASE_URL", TEST_DB_URL)
os.environ.setdefault("WORKSPACE_ROOT", tempfile.mkdtemp())
os.environ.setdefault("OPENAI_API_KEY", "test-key")

from backend.persistence.db import Base, get_db
from backend.main import app


@pytest.fixture(scope="session")
def tmp_workspace(tmp_path_factory):
    """A temporary workspace root directory."""
    return tmp_path_factory.mktemp("workspace")


@pytest.fixture
def tmp_repo(tmp_path) -> Path:
    """A temporary directory that acts as a local repo."""
    (tmp_path / "README.md").write_text("# Test Repo\n\nHello world.")
    (tmp_path / "notes.txt").write_text("Some notes here.")
    (tmp_path / "config.json").write_text('{"version": "1.0"}')
    sub = tmp_path / "subdir"
    sub.mkdir()
    (sub / "file.py").write_text("print('hello')")
    return tmp_path


@pytest_asyncio.fixture
async def db_session():
    """Async DB session backed by in-memory SQLite."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    """HTTP test client with DB override."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
