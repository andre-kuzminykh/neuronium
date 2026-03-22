from __future__ import annotations
from abc import ABC, abstractmethod


class BaseProvider(ABC):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        if not api_key:
            raise ValueError(f"API key not configured for {type(self).__name__}. Add it to .env file.")

    @abstractmethod
    async def generate(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
        mode: str = "canvas",
    ) -> str:
        ...

    def _build_system_prompt(self, mode: str = "canvas") -> str:
        if mode == "chat":
            return (
                "You are an AI assistant embedded in an IDE-like workspace. "
                "The user has a file open and can ask questions about it. "
                "Use the file content as context to answer the user's questions conversationally. "
                "Answer in the same language as the user's message. "
                "If the user asks you to modify or rewrite the content, return the modified content "
                "wrapped in a <<<SUGGESTION>>> ... <<<END_SUGGESTION>>> block so the system can offer "
                "to apply the changes. Outside that block, you may include brief explanations. "
                "If the user simply asks a question, just answer it — do NOT wrap your answer in a suggestion block."
            )
        return (
            "You are an AI writing assistant embedded in an IDE-like workspace. "
            "The user will give you an instruction and content from a file. "
            "Apply the instruction to the content and return ONLY the resulting text. "
            "Do not include explanations, markdown fences, or meta-commentary. "
            "Return only the transformed content."
        )

    def _build_user_message(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
    ) -> str:
        parts = []
        if file_path:
            parts.append(f"File: {file_path}")
        if file_type:
            parts.append(f"Type: {file_type}")
        parts.append(f"\nInstruction: {instruction}")
        parts.append(f"\nContent:\n{content}")

        if attached_files:
            parts.append("\n\nAdditional context files:")
            for path, text in attached_files:
                parts.append(f"\n--- {path} ---\n{text}")

        return "\n".join(parts)
