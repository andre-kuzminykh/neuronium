from __future__ import annotations
import httpx
from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    API_URL = "https://api.anthropic.com/v1/messages"

    async def generate(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
    ) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.API_URL,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "system": self._build_system_prompt(),
                    "messages": [
                        {"role": "user", "content": self._build_user_message(
                            instruction, content, file_path, file_type, attached_files
                        )},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4096,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
