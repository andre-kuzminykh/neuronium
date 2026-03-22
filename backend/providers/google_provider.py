from __future__ import annotations
import httpx
from .base import BaseProvider


class GoogleProvider(BaseProvider):
    API_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    async def generate(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
    ) -> str:
        url = f"{self.API_URL}/{self.model}:generateContent?key={self.api_key}"
        user_msg = self._build_user_message(instruction, content, file_path, file_type, attached_files)

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": self._build_system_prompt()}]},
                    "contents": [{"parts": [{"text": user_msg}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
