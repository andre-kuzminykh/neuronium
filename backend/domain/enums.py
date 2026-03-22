from enum import Enum


class AiScope(str, Enum):
    SELECTION = "selection"
    FULL_FILE = "full_file"
    ACTIVE_TAB = "active_tab"
    ATTACHED_FILES = "attached_files"
    MULTI_FILE = "multi_file"


class SuggestionStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CREATED_FILE = "created_file"


class AiProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPENROUTER = "openrouter"


class FileMode(str, Enum):
    VIEW = "view"
    EDIT = "edit"
