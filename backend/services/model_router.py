from backend.config import settings
from backend.providers.base import BaseProvider


# Model -> (provider_type, actual_model_id)
MODEL_REGISTRY: dict[str, tuple[str, str]] = {
    # OpenAI
    "gpt-4o": ("openai", "gpt-4o"),
    "gpt-4o-mini": ("openai", "gpt-4o-mini"),
    "gpt-4-turbo": ("openai", "gpt-4-turbo"),
    # Anthropic
    "claude-sonnet-4-6": ("anthropic", "claude-sonnet-4-6-20250514"),
    "claude-haiku-3.5": ("anthropic", "claude-3-5-haiku-20241022"),
    # Google
    "gemini-2.0-flash": ("google", "gemini-2.0-flash"),
    "gemini-1.5-pro": ("google", "gemini-1.5-pro"),
    # OpenRouter (passthrough)
    "openrouter/auto": ("openrouter", "openai/gpt-4o"),
}


class ModelRouter:
    def get_provider(self, model_id: str) -> BaseProvider:
        if model_id not in MODEL_REGISTRY:
            # Try openrouter as fallback
            if "/" in model_id:
                provider_type = "openrouter"
                actual_model = model_id
            else:
                raise ValueError(f"Unknown model: {model_id}")
        else:
            provider_type, actual_model = MODEL_REGISTRY[model_id]

        if provider_type == "openai":
            from backend.providers.openai_provider import OpenAIProvider
            return OpenAIProvider(api_key=settings.openai_api_key, model=actual_model)
        elif provider_type == "anthropic":
            from backend.providers.anthropic_provider import AnthropicProvider
            return AnthropicProvider(api_key=settings.anthropic_api_key, model=actual_model)
        elif provider_type == "google":
            from backend.providers.google_provider import GoogleProvider
            return GoogleProvider(api_key=settings.google_api_key, model=actual_model)
        elif provider_type == "openrouter":
            from backend.providers.openrouter_provider import OpenRouterProvider
            return OpenRouterProvider(api_key=settings.openrouter_api_key, model=actual_model)
        else:
            raise ValueError(f"Unknown provider: {provider_type}")

    def list_available_models(self) -> list[dict]:
        models = []
        for model_id, (provider_type, _) in MODEL_REGISTRY.items():
            key_map = {
                "openai": settings.openai_api_key,
                "anthropic": settings.anthropic_api_key,
                "google": settings.google_api_key,
                "openrouter": settings.openrouter_api_key,
            }
            if key_map.get(provider_type):
                models.append({
                    "id": model_id,
                    "name": model_id,
                    "provider": provider_type,
                })
        return models


model_router = ModelRouter()
