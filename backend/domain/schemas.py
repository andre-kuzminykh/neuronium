from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .enums import AiScope, SuggestionStatus


# --- Repo ---

class ConnectLocalRequest(BaseModel):
    path: str


class ConnectRemoteRequest(BaseModel):
    url: str
    name: Optional[str] = None


class RepoInfo(BaseModel):
    id: int
    path: str
    name: str
    is_remote: bool


class FileNode(BaseModel):
    name: str
    path: str  # relative to repo root
    is_dir: bool
    children: Optional[list[FileNode]] = None


class FileContent(BaseModel):
    path: str
    content: str
    encoding: str = "utf-8"
    size: int
    is_binary: bool = False


class FileSaveRequest(BaseModel):
    path: str
    content: str


class FileCreateRequest(BaseModel):
    path: str
    content: str = ""


# --- Session ---

class SessionState(BaseModel):
    active_repo_id: Optional[int] = None
    open_tabs: list[str] = []
    active_tab: Optional[str] = None
    selected_model: Optional[str] = None
    ai_panel_open: bool = True
    file_modes: dict[str, str] = {}  # tab_path -> "view"|"edit"


# --- AI ---

class AiExecuteRequest(BaseModel):
    instruction: str
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    selected_text: Optional[str] = None
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    full_file_content: Optional[str] = None
    attached_files: list[AttachedFile] = []
    scope: AiScope = AiScope.FULL_FILE
    model: Optional[str] = None
    mode: str = "canvas"  # "canvas" | "chat"


class AttachedFile(BaseModel):
    path: str
    content: str


class AiSuggestion(BaseModel):
    id: str
    file_path: Optional[str] = None
    scope: AiScope
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    original_text: Optional[str] = None
    result_text: str
    diff: Optional[str] = None
    status: SuggestionStatus = SuggestionStatus.PENDING
    created_at: datetime
    model_name: str
    command_text: str
    latency_ms: Optional[int] = None


class AiApplyRequest(BaseModel):
    suggestion_id: str


class AiCreateFileRequest(BaseModel):
    suggestion_id: str
    new_file_path: str


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str


# --- Automation ---

class AutomationTemplate(BaseModel):
    id: Optional[int] = None
    name: str
    instruction: str
    scope: AiScope = AiScope.FULL_FILE
    model: Optional[str] = None


class AutomationRunRequest(BaseModel):
    template_id: int
    file_paths: list[str]


# --- File Links ---

class FileLinkCreate(BaseModel):
    repo_id: int
    source_file: str
    target_file: str
    position_start: Optional[int] = None
    link_text: str


class FileLinkInfo(BaseModel):
    id: int
    repo_id: int
    source_file: str
    target_file: str
    position_start: Optional[int] = None
    link_text: str
    created_at: datetime


# --- Search ---

class SearchMatch(BaseModel):
    line: int
    text: str


class SearchResult(BaseModel):
    path: str
    matches: list[SearchMatch]


# Rebuild model for forward references
AiExecuteRequest.model_rebuild()
FileNode.model_rebuild()
