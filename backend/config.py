from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""

    workspace_root: str = "./workspaces"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    database_url: str = "sqlite+aiosqlite:///./neuronium.db"
    log_level: str = "INFO"

    max_file_size_bytes: int = 2 * 1024 * 1024  # 2MB
    max_ai_context_bytes: int = 512 * 1024  # 512KB

    @property
    def workspace_path(self) -> Path:
        p = Path(self.workspace_root)
        p.mkdir(parents=True, exist_ok=True)
        return p.resolve()

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
