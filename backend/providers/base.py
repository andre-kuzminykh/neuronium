from abc import ABC, abstractmethod


class BaseProvider(ABC):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        if not api_key:
            raise ValueError(f"API key not configured for provider")

    @abstractmethod
    async def generate(
        self,
        instruction: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
        attached_files: list[tuple[str, str]] | None = None,
    ) -> str:
        ...

    def _build_system_prompt(self) -> str:
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
