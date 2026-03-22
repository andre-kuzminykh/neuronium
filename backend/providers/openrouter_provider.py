import httpx
from .base import BaseProvider


class OpenRouterProvider(BaseProvider):
    API_URL = "https://openrouter.ai/api/v1/chat/completions"

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
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self._build_system_prompt()},
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
            return data["choices"][0]["message"]["content"]
