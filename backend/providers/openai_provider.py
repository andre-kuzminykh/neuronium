from __future__ import annotations
import httpx
from .base import BaseProvider


class OpenAIProvider(BaseProvider):
    API_URL = "https://api.openai.com/v1/chat/completions"

    async def generate(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
        mode: str = "canvas",
    ) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self._build_system_prompt(mode)},
                        {"role": "user", "content": self._build_user_message(
                            instruction, content, file_path, file_type, attached_files
                        )},
                    ],
                    "temperature": 0.3,
                    "max_completion_tokens": 4096,
                },
            )
            if response.status_code != 200:
                err_body = response.text[:500]
                raise ValueError(f"OpenAI API error {response.status_code}: {err_body}")
            data = response.json()
            return data["choices"][0]["message"]["content"]
