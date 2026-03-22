from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from datetime import datetime, timezone
from .db import Base


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    path = Column(Text, nullable=False, unique=True)
    is_remote = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True, default="default")
    state = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class AiCommand(Base):
    __tablename__ = "ai_commands"

    id = Column(String(36), primary_key=True)
    repo_id = Column(Integer, nullable=True)
    file_path = Column(Text, nullable=True)
    scope = Column(String(50), nullable=False)
    instruction = Column(Text, nullable=False)
    original_text = Column(Text, nullable=True)
    result_text = Column(Text, nullable=True)
    diff = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    model_name = Column(String(100), nullable=False)
    latency_ms = Column(Integer, nullable=True)
    selection_start = Column(Integer, nullable=True)
    selection_end = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AutomationTemplate(Base):
    __tablename__ = "automation_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    instruction = Column(Text, nullable=False)
    scope = Column(String(50), default="full_file")
    model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(Integer, nullable=False)
    file_paths = Column(JSON, nullable=False)
    status = Column(String(20), default="running")
    result_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FileLink(Base):
    """Tracks markdown links inserted by dragging files into the editor."""
    __tablename__ = "file_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, nullable=False)
    source_file = Column(Text, nullable=False)   # file where link lives
    target_file = Column(Text, nullable=False)   # file being linked to
    position_start = Column(Integer, nullable=True)  # char offset in source
    link_text = Column(Text, nullable=False)     # "[name](path)"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
